import 'server-only';

type ClientServerEnvKey = 'DATABASE_URL';

const SECRET_LIKE_PUBLIC_KEY = /(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE|SERVICE_ROLE)/i;

export function getServerEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

export function requireServerEnv(name: ClientServerEnvKey) {
  const value = getServerEnv(name);

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function assertNoPublicSecrets() {
  const unsafeKeys = Object.keys(process.env).filter(
    (key) => key.startsWith('NEXT_PUBLIC_') && SECRET_LIKE_PUBLIC_KEY.test(key),
  );

  if (unsafeKeys.length > 0) {
    throw new Error(`Secret-like variables must not use NEXT_PUBLIC_: ${unsafeKeys.join(', ')}`);
  }
}

assertNoPublicSecrets();
