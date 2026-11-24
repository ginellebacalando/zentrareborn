import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

type Environment = Record<string, string | undefined>;
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function localAdminAccessConfig(env: Environment = process.env, now = Date.now()) {
  if (
    env.NODE_ENV !== 'development' ||
    env.ADMIN_LOCAL_ACCESS_ENABLED !== 'true' ||
    (env.DEPLOYMENT_ENV && !['local', 'development'].includes(env.DEPLOYMENT_ENV))
  )
    return null;

  const expiresAt = Date.parse(env.ADMIN_LOCAL_ACCESS_UNTIL || '');
  const email = env.ADMIN_LOCAL_ACCESS_EMAIL?.trim().toLowerCase();
  const tokenHash = env.ADMIN_LOCAL_ACCESS_TOKEN_HASH || '';
  if (!email || !/^[a-f0-9]{64}$/.test(tokenHash) || !(expiresAt > now)) return null;

  try {
    const app = new URL(env.AUTH_URL || '');
    const database = new URL(env.DATABASE_URL || '');
    if (
      app.protocol !== 'http:' ||
      !loopbackHosts.has(app.hostname) ||
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !loopbackHosts.has(database.hostname)
    )
      return null;
    return { email, tokenHash, expiresAt, origin: app.origin, host: app.host };
  } catch {
    return null;
  }
}

export function validateLocalAdminAccess(
  token: unknown,
  request: Request,
  env: Environment = process.env,
  now = Date.now(),
) {
  const config = localAdminAccessConfig(env, now);
  if (!config || typeof token !== 'string' || !/^[\w-]{43}$/.test(token)) return null;
  if (
    request.headers.get('origin') !== config.origin ||
    !isLocalAdminRequest(request.headers, config)
  )
    return null;

  return tokenMatches(token, config.tokenHash) ? config : null;
}

function isLocalAdminRequest(
  headers: Headers,
  config: NonNullable<ReturnType<typeof localAdminAccessConfig>>,
) {
  if (
    headers.get('host') !== config.host ||
    headers.get('sec-fetch-site') === 'cross-site' ||
    headers.has('forwarded')
  )
    return false;
  const origin = headers.get('origin');
  if (origin && origin !== config.origin) return false;
  const forwardedHost = headers.get('x-forwarded-host');
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedHost && forwardedHost !== config.host) return false;
  if (
    forwardedFor &&
    forwardedFor
      .split(',')
      .some((address) => !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address.trim()))
  )
    return false;
  return true;
}

function tokenMatches(token: string, tokenHash: string) {
  const suppliedHash = createHash('sha256').update(token).digest();
  return timingSafeEqual(suppliedHash, Buffer.from(tokenHash, 'hex'));
}

export function localAdminAutoLoginToken(
  headers: Headers,
  env: Environment = process.env,
  now = Date.now(),
) {
  if (env.ADMIN_LOCAL_ACCESS_AUTO_LOGIN !== 'true') return null;
  const config = localAdminAccessConfig(env, now);
  const token = env.ADMIN_LOCAL_ACCESS_TOKEN || '';
  if (
    !config ||
    !/^[\w-]{43}$/.test(token) ||
    !isLocalAdminRequest(headers, config) ||
    !tokenMatches(token, config.tokenHash)
  )
    return null;
  // Only an explicitly enabled, unexpired loopback development page receives it.
  // The credentials provider still creates and checks the usual audited session.
  return token;
}
