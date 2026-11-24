import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { TOTP, Secret } from 'otpauth';

export class DeveloperError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function equalSecret(a: string, b: string) {
  return timingSafeEqual(Buffer.from(hash(a), 'hex'), Buffer.from(hash(b), 'hex'));
}

export function developerConfig() {
  if (process.env.DEVELOPER_PANEL_ENABLED !== 'true') return null;
  const key = process.env.DEVELOPER_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(key)) return null;
  let origin: URL;
  try {
    origin = new URL(process.env.DEVELOPER_ORIGIN || '');
  } catch {
    return null;
  }
  const production = process.env.NODE_ENV === 'production';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
    return null;
  if (origin.protocol !== 'https:' && (production || !local || origin.protocol !== 'http:'))
    return null;
  if (production && (process.env.DEVELOPER_GATEWAY_SECRET || '').length < 43) return null;
  const emails = (process.env.DEVELOPER_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length) return null;
  return {
    key: Buffer.from(key, 'hex'),
    origin: origin.origin,
    production,
    emails,
  };
}

export function assertDeveloperGate(headers: Headers) {
  const config = developerConfig();
  if (
    !config ||
    (config.production &&
      !equalSecret(
        headers.get('x-zion-developer-gateway') || '',
        process.env.DEVELOPER_GATEWAY_SECRET || '',
      ))
  ) {
    throw new DeveloperError('Not found.', 404);
  }
  return config;
}

export function assertDeveloperOrigin(request: Request) {
  const config = assertDeveloperGate(request.headers);
  if (
    request.headers.get('origin') !== config.origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new DeveloperError('Request origin rejected.', 403);
  }
}

export function sealSecret(secret: string, key: Buffer, accountId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(accountId));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((v) => v.toString('base64url')).join('.');
}

export function openSecret(sealed: string, key: Buffer, accountId: string) {
  const [iv, tag, ciphertext] = sealed.split('.').map((v) => Buffer.from(v, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(accountId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function totpFor(secret: string, email = 'Developer') {
  return new TOTP({
    issuer: 'Zion Developer',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}

export function totpStep(secret: string, token: string, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(token)) return null;
  const delta = totpFor(secret).validate({ token, timestamp, window: 1 });
  return delta === null ? null : Math.floor(timestamp / 30000) + delta;
}

export function developerCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-zion-developer' : 'zion-developer';
}

export function developerResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(status === 429 ? { 'Retry-After': '900' } : {}),
    },
  });
}

export async function readDeveloperJson(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new DeveloperError('JSON required.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new DeveloperError('Request body required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 70000) {
      await reader.cancel();
      throw new DeveloperError('Request is too large.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new DeveloperError('Invalid JSON.');
  }
}
