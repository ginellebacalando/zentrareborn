// Run from a trusted operator terminal. Never accept passwords through CLI arguments.
import { config as loadEnv } from 'dotenv';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { Secret } from 'otpauth';
import { z } from 'zod';
import { sealSecret, totpFor, totpStep } from '../lib/developer/security';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const emailArg = args
  .find((v) => v.startsWith('--email='))
  ?.slice(8)
  .trim()
  .toLowerCase();
if (emailArg && !z.email().safeParse(emailArg).success)
  throw new Error('Provide a valid developer email.');
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const target = new URL(connectionString);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
const changes = flag('--install') || flag('--create') || flag('--disable') || flag('--rotate');
if (changes && !local && !flag('--allow-remote'))
  throw new Error(
    'Remote changes require --allow-remote after the database owner authorizes the target.',
  );
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5000,
});
async function hiddenPrompt(label: string): Promise<string> {
  if (!stdin.isTTY) throw new Error('Credential enrollment requires an interactive terminal.');
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const handler = (buffer: Buffer) => {
      for (const char of buffer.toString()) {
        if (char === '\u0003') {
          finish();
          reject(new Error('Enrollment cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= ' ' && value.length < 128) value += char;
      }
    };
    const finish = () => {
      stdin.off('data', handler);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    stdin.on('data', handler);
  });
}
try {
  if (flag('--install')) {
    await pool.query(readFileSync(new URL('../prisma/developer.sql', import.meta.url), 'utf8'));
    console.log(
      'Installed additive developer tables. Existing client and staff data is preserved.',
    );
  }
  if (flag('--disable')) {
    if (!emailArg) throw new Error('Use --email=developer@example.com.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        'UPDATE zion_developer_accounts SET enabled=false WHERE email=$1 RETURNING id',
        [emailArg],
      );
      if (!r.rowCount) throw new Error('Developer account not found.');
      await client.query(
        'UPDATE zion_developer_sessions SET revoked_at=now() WHERE developer_id=$1',
        [r.rows[0].id],
      );
      await client.query(
        "INSERT INTO zion_developer_audit (id,actor,action,target,result) VALUES ($1,'system-operator','ACCOUNT_DISABLE',$2,'success')",
        [randomUUID(), r.rows[0].id],
      );
      await client.query('COMMIT');
      console.log('Developer disabled. All developer sessions revoked.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  if (flag('--create') || flag('--rotate')) {
    if (!emailArg)
      throw new Error('Use --email=developer@example.com for an explicitly approved developer.');
    if (!stdin.isTTY) throw new Error('Run enrollment in an interactive operator terminal.');
    let key = process.env.DEVELOPER_ENCRYPTION_KEY || '';
    if (!key && local && process.env.NODE_ENV !== 'production') {
      key = randomBytes(32).toString('hex');
      const file = '.env.local',
        existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
      const updated = existing.replace(/^DEVELOPER_ENCRYPTION_KEY=.*\r?\n?/m, '');
      writeFileSync(file, `${updated.trimEnd()}\nDEVELOPER_ENCRYPTION_KEY=${key}\n`, {
        mode: 0o600,
      });
      console.log('Generated a server-only local encryption key in .env.local.');
    }
    if (!/^[a-f0-9]{64}$/i.test(key))
      throw new Error(
        'Set DEVELOPER_ENCRYPTION_KEY to a secure random 32-byte hex key in the server secret manager first.',
      );
    const password = await hiddenPrompt('New developer password (16–72 UTF-8 bytes, hidden): ');
    if (Buffer.byteLength(password) < 16 || Buffer.byteLength(password) > 72)
      throw new Error('Use a password between 16 and 72 UTF-8 bytes.');
    const confirm = await hiddenPrompt('Confirm password: ');
    if (password !== confirm) throw new Error('Passwords do not match.');
    const existing = await pool.query('SELECT id FROM zion_developer_accounts WHERE email=$1', [
      emailArg,
    ]);
    if (existing.rowCount && !flag('--rotate'))
      throw new Error(
        'Account exists. Use --rotate to explicitly replace its password and authenticator, revoking its sessions.',
      );
    if (!existing.rowCount && flag('--rotate'))
      throw new Error('Account not found. Use --create for a new developer.');
    const id = existing.rows[0]?.id || randomUUID();
    const secret = new Secret({ size: 20 }).base32;
    console.log(
      "Add this enrollment URI to the developer's authenticator through a private channel. Do not save it in chat, source control, or shared logs:",
    );
    console.log(totpFor(secret, emailArg).toString());
    const prompt = createInterface({ input: stdin, output: stdout });
    const code = await prompt.question('Enter its current 6-digit code to verify enrollment: ');
    prompt.close();
    const step = totpStep(secret, code.trim());
    if (step === null)
      throw new Error('Authenticator verification failed. No account was changed.');
    const passwordHash = await bcrypt.hash(password, 12),
      sealed = sealSecret(secret, Buffer.from(key, 'hex'), id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO zion_developer_accounts (id,email,name,password_hash,totp_secret,last_totp_step) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,totp_secret=EXCLUDED.totp_secret,last_totp_step=EXCLUDED.last_totp_step,enabled=true',
        [id, emailArg, emailArg.split('@')[0], passwordHash, sealed, step],
      );
      await client.query(
        'UPDATE zion_developer_sessions SET revoked_at=now() WHERE developer_id=$1',
        [id],
      );
      await client.query(
        "INSERT INTO zion_developer_audit (id,actor,action,target,result) VALUES ($1,'system-operator',$2,$3,'success')",
        [randomUUID(), existing.rowCount ? 'ACCOUNT_ROTATE' : 'ACCOUNT_CREATE', id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(
      'Developer enrolled. Add this email to DEVELOPER_EMAIL_ALLOWLIST and set DEVELOPER_PANEL_ENABLED=true and DEVELOPER_ORIGIN before opening /developer.',
    );
  }
  if (!changes) {
    const r = await pool.query(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'zion_developer_%'",
    );
    console.log(`Developer schema: ${r.rows[0].count}/8 tables. Check only.`);
  }
} finally {
  await pool.end();
}
