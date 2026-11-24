import 'server-only';

type Environment = Record<string, string | undefined>;
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
export const localDeveloperPrefix = 'local-developer:';
export const developerAccessWeekMs = 7 * 24 * 60 * 60 * 1000;

export function localDeveloperAccessConfig(env: Environment = process.env, now = Date.now()) {
  if (
    env.NODE_ENV !== 'development' ||
    env.DEVELOPER_LOCAL_ACCESS_ENABLED !== 'true' ||
    env.VERCEL ||
    env.VERCEL_ENV ||
    (env.DEPLOYMENT_ENV && !['local', 'development'].includes(env.DEPLOYMENT_ENV))
  )
    return null;
  const startedAt = Date.parse(env.DEVELOPER_LOCAL_ACCESS_STARTED_AT || '');
  const expiresAt = Date.parse(env.DEVELOPER_LOCAL_ACCESS_UNTIL || '');
  const leaseId = env.DEVELOPER_LOCAL_ACCESS_ID || '';
  if (
    !/^[a-f0-9]{32}$/.test(leaseId) ||
    !Number.isFinite(startedAt) ||
    !(startedAt <= now && now < expiresAt) ||
    expiresAt - startedAt > developerAccessWeekMs
  )
    return null;
  try {
    const app = new URL(env.DEVELOPER_ORIGIN || '');
    const database = new URL(env.DATABASE_URL || '');
    if (
      app.protocol !== 'http:' ||
      !loopback.has(app.hostname) ||
      app.username ||
      app.password ||
      app.pathname !== '/' ||
      app.search ||
      app.hash ||
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !loopback.has(database.hostname)
    )
      return null;
    return {
      id: `${localDeveloperPrefix}${leaseId}`,
      email: `local-${leaseId}@developer.invalid`,
      startedAt,
      expiresAt,
      origin: app.origin,
      host: app.host,
    };
  } catch {
    return null;
  }
}

export function localDeveloperAccessForRequest(
  headers: Headers,
  env: Environment = process.env,
  now = Date.now(),
) {
  const config = localDeveloperAccessConfig(env, now);
  if (!config || headers.get('host') !== config.host || headers.has('forwarded')) return null;
  const site = headers.get('sec-fetch-site');
  if (site && !['none', 'same-origin'].includes(site)) return null;
  const origin = headers.get('origin');
  if (origin && origin !== config.origin) return null;
  const forwardedHost = headers.get('x-forwarded-host');
  const forwardedProto = headers.get('x-forwarded-proto');
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedHost && forwardedHost !== config.host) return null;
  if (forwardedProto && forwardedProto !== 'http') return null;
  if (
    forwardedFor &&
    forwardedFor
      .split(',')
      .some((value) => !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value.trim()))
  )
    return null;
  return config;
}
