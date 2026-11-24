import 'server-only';

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const privateRanges = new BlockList();

for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  privateRanges.addSubnet(address, prefix, 'ipv4');
}

for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['::ffff:0:0', 96],
] as const) {
  privateRanges.addSubnet(address, prefix, 'ipv6');
}

export type ReceptionistBookingConfig =
  | {
      state: 'disabled' | 'not_configured' | 'invalid';
      reason: string;
    }
  | {
      state: 'ready';
      endpoint: URL;
      requestSecret: string;
      responseSecret: string;
      timeoutMs: number;
      leaseMs: number;
      maxAttempts: number;
      retryBaseMs: number;
      maxResponseBytes: number;
      signatureToleranceSeconds: number;
    };

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function readReceptionistBookingConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ReceptionistBookingConfig {
  if (environment.RECEPTIONIST_BOOKING_ORCHESTRATION_ENABLED !== 'true') {
    return { state: 'disabled', reason: 'Booking orchestration is disabled.' };
  }

  const rawEndpoint = environment.RECEPTIONIST_BOOKING_ORCHESTRATION_URL?.trim();
  const requestSecret = environment.RECEPTIONIST_BOOKING_REQUEST_SECRET?.trim();
  const responseSecret = environment.RECEPTIONIST_BOOKING_RESPONSE_SECRET?.trim();
  const approvedHosts = (environment.RECEPTIONIST_BOOKING_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (!rawEndpoint || !requestSecret || !responseSecret || approvedHosts.length === 0) {
    return { state: 'not_configured', reason: 'Booking orchestration is incomplete.' };
  }
  if (requestSecret.length < 43 || responseSecret.length < 43) {
    return { state: 'invalid', reason: 'Booking orchestration credentials are invalid.' };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    return { state: 'invalid', reason: 'Booking orchestration endpoint is invalid.' };
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !approvedHosts.includes(endpoint.hostname.toLowerCase())
  ) {
    return { state: 'invalid', reason: 'Booking orchestration endpoint is not approved.' };
  }

  const timeoutMs = boundedInteger(environment.RECEPTIONIST_BOOKING_TIMEOUT_MS, 8000, 1000, 30000);

  return {
    state: 'ready',
    endpoint,
    requestSecret,
    responseSecret,
    timeoutMs,
    leaseMs: boundedInteger(
      environment.RECEPTIONIST_BOOKING_LEASE_MS,
      Math.max(15000, timeoutMs + 5000),
      timeoutMs + 1000,
      120000,
    ),
    maxAttempts: boundedInteger(environment.RECEPTIONIST_BOOKING_MAX_ATTEMPTS, 2, 1, 3),
    retryBaseMs: boundedInteger(environment.RECEPTIONIST_BOOKING_RETRY_BASE_MS, 1000, 1000, 30000),
    maxResponseBytes: boundedInteger(
      environment.RECEPTIONIST_BOOKING_MAX_RESPONSE_BYTES,
      65536,
      1024,
      262144,
    ),
    signatureToleranceSeconds: boundedInteger(
      environment.RECEPTIONIST_BOOKING_SIGNATURE_TOLERANCE_SECONDS,
      300,
      30,
      600,
    ),
  };
}

export type ResolveBookingHost = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

async function resolveBookingHost(hostname: string) {
  if (isIP(hostname)) return [{ address: hostname, family: isIP(hostname) }];
  return lookup(hostname, { all: true });
}

export async function assertPublicReceptionistBookingHost(
  endpoint: URL,
  resolveHost: ResolveBookingHost = resolveBookingHost,
) {
  const hostname = endpoint.hostname.replace(/^\[|\]$/g, '');
  const addresses = await resolveHost(hostname);
  if (
    addresses.length === 0 ||
    addresses.some((entry) =>
      privateRanges.check(entry.address, entry.family === 6 ? 'ipv6' : 'ipv4'),
    )
  ) {
    throw new Error('Booking orchestration resolved to a prohibited network destination.');
  }
}
