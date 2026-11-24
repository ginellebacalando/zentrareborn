import 'server-only';
import pg, { type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { DeveloperError, hash } from './security';

const globalDb = globalThis as unknown as { developerPool?: pg.Pool };
// Separate from Prisma's development query logger: credentials and knowledge are never logged.
export const developerDb =
  globalDb.developerPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 8000,
  });
if (process.env.NODE_ENV !== 'production') globalDb.developerPool = developerDb;

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await developerDb.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function audit(
  actor: string,
  action: string,
  target: string,
  result = 'success',
  client: pg.Pool | PoolClient = developerDb,
) {
  await client.query(
    'INSERT INTO zion_developer_audit (id,actor,action,target,result) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), actor, action, target.slice(0, 180), result],
  );
}

export async function rateLimit(key: string, maximum: number, seconds = 900) {
  await developerDb.query(
    "DELETE FROM zion_developer_rate_limits WHERE window_at < now() - interval '2 days'",
  );
  const result = await developerDb.query<{ attempts: number }>(
    `
    INSERT INTO zion_developer_rate_limits (key,attempts,window_at) VALUES ($1,1,now())
    ON CONFLICT (key) DO UPDATE SET
    attempts = CASE WHEN zion_developer_rate_limits.window_at < now() - $2 * interval '1 second' THEN 1 ELSE zion_developer_rate_limits.attempts + 1 END,
    window_at = CASE WHEN zion_developer_rate_limits.window_at < now() - $2 * interval '1 second' THEN now() ELSE zion_developer_rate_limits.window_at END
    RETURNING attempts`,
    [hash(key), seconds],
  );
  if (result.rows[0].attempts > maximum)
    throw new DeveloperError('Too many attempts. Try again in 15 minutes.', 429);
}
