import 'server-only';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Secret } from 'otpauth';
import { localDeveloperAccessForRequest, localDeveloperPrefix } from './local-access';
import { audit, developerDb, rateLimit, transaction } from './db';
import {
  assertDeveloperGate,
  developerConfig,
  developerCookieName,
  DeveloperError,
  equalSecret,
  hash,
  openSecret,
  sealSecret,
  totpStep,
} from './security';

export type DeveloperActor = {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  expiresAt: string;
  csrfHash: string;
  localDevelopmentAccess?: boolean;
};
const dummyHash = '$2b$12$Y7BhLbYrE/BlxtDJYZPPyeM57oiYOQCxhYEaACprXcShgQ.yCJTH2';
const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(128),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();

export async function consumeTotp(id: string, code: string) {
  const config = developerConfig();
  if (!config) throw new DeveloperError('Not found.', 404);
  if (id.startsWith(localDeveloperPrefix))
    throw new DeveloperError('Temporary local identities cannot use credential sign-in.', 403);
  await rateLimit(`mfa:${id}`, 20);
  const { rows } = await developerDb.query<{
    totp_secret: string;
    enabled: boolean;
  }>('SELECT totp_secret,enabled FROM zion_developer_accounts WHERE id=$1', [id]);
  const user = rows[0];
  if (!user?.enabled) throw new DeveloperError('Verification failed.', 403);
  const step = totpStep(openSecret(user.totp_secret, config.key, id), code);
  if (step === null)
    throw new DeveloperError('Verification failed. Use a fresh authenticator code.', 403);
  const consumed = await developerDb.query(
    'UPDATE zion_developer_accounts SET last_totp_step=$2 WHERE id=$1 AND enabled=true AND last_totp_step < $2 RETURNING id',
    [id, step],
  );
  if (!consumed.rowCount)
    throw new DeveloperError('Verification failed. Wait for a new authenticator code.', 403);
}

export async function loginDeveloper(input: unknown, headers: Headers) {
  const config = assertDeveloperGate(headers);
  await rateLimit('login:global', 100);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    throw new DeveloperError('Sign-in failed. Check your credentials and authenticator code.', 401);
  const { email, password, code } = parsed.data;
  await rateLimit(`login:${email}`, 6);
  const { rows } = await developerDb.query<{
    id: string;
    password_hash: string;
    enabled: boolean;
  }>('SELECT id,password_hash,enabled FROM zion_developer_accounts WHERE email=$1', [email]);
  const user = rows[0];
  const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);
  if (
    !user?.enabled ||
    !valid ||
    !config.emails.includes(email) ||
    user.id.startsWith(localDeveloperPrefix)
  ) {
    await audit(hash(email), 'SIGN_IN', 'developer', 'denied');
    throw new DeveloperError('Sign-in failed. Check your credentials and authenticator code.', 401);
  }
  try {
    await consumeTotp(user.id, code);
  } catch (error) {
    await audit(user.id, 'SIGN_IN', 'developer', 'denied');
    if (error instanceof DeveloperError && error.status === 429) throw error;
    throw new DeveloperError('Sign-in failed. Check your credentials and authenticator code.', 401);
  }
  const token = randomBytes(32).toString('base64url');
  const sessionId = randomUUID();
  const csrf = csrfFor(token, sessionId, config.key);
  await transaction(async (client) => {
    await client.query(
      'UPDATE zion_developer_sessions SET revoked_at=now() WHERE developer_id=$1 AND revoked_at IS NULL',
      [user.id],
    );
    await client.query(
      "INSERT INTO zion_developer_sessions (id,developer_id,token_hash,csrf_hash,expires_at) VALUES ($1,$2,$3,$4,now()+interval '30 minutes')",
      [sessionId, user.id, hash(token), hash(csrf)],
    );
    await audit(user.id, 'SIGN_IN', 'developer', 'success', client);
  });
  return { token, csrf };
}

export async function developerFromToken(
  token: string,
  headers: Headers,
): Promise<DeveloperActor | null> {
  const config = assertDeveloperGate(headers);
  if (!/^[\w-]{43}$/.test(token)) return null;
  const localAccess = localDeveloperAccessForRequest(headers);
  const allowedEmails = localAccess ? [...config.emails, localAccess.email] : config.emails;
  const { rows } = await developerDb.query<{
    id: string;
    email: string;
    name: string;
    session_id: string;
    expires_at: Date;
    csrf_hash: string;
  }>(
    `
    UPDATE zion_developer_sessions s SET last_seen_at=now() FROM zion_developer_accounts a
    WHERE s.token_hash=$1 AND s.developer_id=a.id AND a.enabled=true AND a.email=ANY($2::text[])
    AND s.revoked_at IS NULL AND s.expires_at>now()
    AND (s.last_seen_at>now()-interval '10 minutes' OR a.id=$3)
    RETURNING a.id,a.email,a.name,s.id AS session_id,s.expires_at,s.csrf_hash`,
    [hash(token), allowedEmails, localAccess?.id ?? ''],
  );
  const user = rows[0];
  const isLocal = user?.id.startsWith(localDeveloperPrefix) ?? false;
  if (isLocal && (!localAccess || user.id !== localAccess.id)) return null;
  return user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        sessionId: user.session_id,
        expiresAt: new Date(
          Math.min(user.expires_at.getTime(), isLocal ? localAccess!.expiresAt : Infinity),
        ).toISOString(),
        csrfHash: user.csrf_hash,
        localDevelopmentAccess: isLocal,
      }
    : null;
}

export async function createLocalDeveloperSession(headers: Headers) {
  const config = assertDeveloperGate(headers);
  const lease = localDeveloperAccessForRequest(headers);
  if (!lease)
    throw new DeveloperError('Temporary local access is unavailable or has expired.', 403);
  const token = randomBytes(32).toString('base64url');
  const sessionId = randomUUID();
  const csrf = csrfFor(token, sessionId, config.key);
  // These credentials are never disclosed or usable through the normal login provider.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('base64url'), 12);
  const sealedSeed = sealSecret(new Secret({ size: 20 }).base32, config.key, lease.id);
  await transaction(async (client) => {
    await client.query(
      "INSERT INTO zion_developer_accounts (id,email,name,password_hash,totp_secret) VALUES ($1,$2,'Local Developer',$3,$4) ON CONFLICT (id) DO NOTHING",
      [lease.id, lease.email, passwordHash, sealedSeed],
    );
    const account = await client.query<{ enabled: boolean }>(
      'SELECT enabled FROM zion_developer_accounts WHERE id=$1 FOR UPDATE',
      [lease.id],
    );
    if (!account.rows[0]?.enabled)
      throw new DeveloperError('Local developer access has been disabled.', 403);
    await client.query(
      'INSERT INTO zion_developer_sessions (id,developer_id,token_hash,csrf_hash,expires_at) VALUES ($1,$2,$3,$4,$5)',
      [sessionId, lease.id, hash(token), hash(csrf), new Date(lease.expiresAt)],
    );
    await audit(
      lease.id,
      'LOCAL_ACCESS_START',
      new Date(lease.expiresAt).toISOString(),
      'success',
      client,
    );
  });
  return { token, csrf, expiresAt: lease.expiresAt };
}

export async function verifyDeveloperChange(actor: DeveloperActor, code: string, headers: Headers) {
  if (actor.localDevelopmentAccess) {
    const lease = localDeveloperAccessForRequest(headers);
    if (!lease || lease.id !== actor.id)
      throw new DeveloperError('Temporary local access has expired.', 403);
    return;
  }
  await consumeTotp(actor.id, code);
}

export async function currentDeveloper(headers: Headers) {
  const token = (await cookies()).get(developerCookieName())?.value || '';
  return developerFromToken(token, headers);
}

export async function requireDeveloper(request: Request, mutate = false) {
  assertDeveloperGate(request.headers);
  const actor = await currentDeveloper(request.headers);
  if (!actor) throw new DeveloperError('Developer authentication required.', 401);
  if (mutate && !equalSecret(hash(request.headers.get('x-developer-csrf') || ''), actor.csrfHash))
    throw new DeveloperError('Session verification failed. Sign in again.', 403);
  return actor;
}

function csrfFor(token: string, sessionId: string, key: Buffer) {
  return createHmac('sha256', key)
    .update(`developer-csrf:${sessionId}:${token}`)
    .digest('base64url');
}

export async function sessionCsrf(actor: DeveloperActor) {
  const config = developerConfig();
  if (!config) throw new DeveloperError('Not found.', 404);
  const token = (await cookies()).get(developerCookieName())?.value || '';
  // Stable per session: opening a second tab cannot invalidate the first tab's form.
  return csrfFor(token, actor.sessionId, config.key);
}
