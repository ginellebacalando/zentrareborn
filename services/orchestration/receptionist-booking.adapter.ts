import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  assertPublicReceptionistBookingHost,
  readReceptionistBookingConfig,
  type ReceptionistBookingConfig,
} from '@/lib/orchestration/config/receptionist-booking';
import {
  RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  isReceptionistBookingResultCompatible,
  receptionistBookingRequestSchema,
  receptionistBookingResultSchema,
  type ReceptionistBookingLedger,
  type ReceptionistBookingLedgerClaim,
  type ReceptionistBookingRequest,
  type ReceptionistBookingResult,
} from './receptionist-booking.contract';

type BookingTransport = (input: string | URL, init: RequestInit) => Promise<Response>;

export type ReceptionistBookingAdapterDependencies = {
  ledger?: ReceptionistBookingLedger;
  getConfig?: () => ReceptionistBookingConfig | Promise<ReceptionistBookingConfig>;
  transport?: BookingTransport;
  verifyDestination?: (endpoint: URL) => Promise<void>;
  now?: () => Date;
  reportPersistenceFailure?: (operation: 'acquire' | 'complete' | 'fail') => void;
};

export type ReceptionistBookingAdapter = {
  execute(request: unknown): Promise<ReceptionistBookingResult>;
};

type ErrorCode = Extract<ReceptionistBookingResult, { status: 'ERROR' }>['errorCode'];

class WorkflowCallError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

export function signReceptionistBookingBody(body: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifyReceptionistBookingSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signReceptionistBookingBody(body, timestamp, secret), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function requestFingerprint(request: ReceptionistBookingRequest) {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex');
}

function matchesCorrelation(
  request: ReceptionistBookingRequest,
  result: ReceptionistBookingResult,
) {
  return (
    result.requestId === request.requestId &&
    result.conversationId === request.conversationId &&
    result.turnId === request.turnId &&
    result.stateRevision === request.stateRevision
  );
}

function isFreshAndUsableResult(
  result: ReceptionistBookingResult,
  currentTime: Date,
  toleranceSeconds: number,
) {
  if (result.status === 'ERROR') return true;
  const currentEpoch = currentTime.getTime();
  const toleranceMs = toleranceSeconds * 1000;
  const respondedAt = Date.parse(result.respondedAt);
  const observedAt = Date.parse(result.provenance.observedAt);
  if (
    Math.abs(currentEpoch - respondedAt) > toleranceMs ||
    Math.abs(currentEpoch - observedAt) > toleranceMs
  ) {
    return false;
  }
  if (result.status === 'HOLD_CREATED' && Date.parse(result.expiresAt) <= currentEpoch) {
    return false;
  }
  if (
    result.status === 'PENDING_PAYMENT' &&
    (Date.parse(result.paymentDeadline) <= currentEpoch ||
      (result.holdExpiresAt && Date.parse(result.holdExpiresAt) <= currentEpoch))
  ) {
    return false;
  }
  return true;
}

function errorResult(
  request: ReceptionistBookingRequest,
  now: Date,
  errorCode: ErrorCode,
  retryable: boolean,
  retryAfterSeconds?: number,
): ReceptionistBookingResult {
  return {
    schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
    requestId: request.requestId,
    conversationId: request.conversationId,
    turnId: request.turnId,
    stateRevision: request.stateRevision,
    respondedAt: now.toISOString(),
    provenance: {
      source: 'orchestration_adapter',
      authoritative: false,
      observedAt: now.toISOString(),
    },
    status: 'ERROR',
    errorCode,
    retryable,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

async function readBoundedBody(response: Response, maximum: number) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new WorkflowCallError('INVALID_RESPONSE', false);
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function httpFailure(response: Response) {
  if (response.status === 401 || response.status === 403) {
    return new WorkflowCallError('AUTHENTICATION_FAILED', false);
  }
  if (response.status === 409) return new WorkflowCallError('CONFLICT', false);
  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    return new WorkflowCallError(
      'RATE_LIMITED',
      true,
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 3600) : undefined,
    );
  }
  return new WorkflowCallError(
    response.status >= 500 ? 'TEMPORARY_UNAVAILABLE' : 'INVALID_RESPONSE',
    response.status >= 500,
  );
}

function classifyFailure(error: unknown) {
  if (error instanceof WorkflowCallError) return error;
  if (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return new WorkflowCallError('TIMEOUT', true);
  }
  return new WorkflowCallError('TRANSPORT_ERROR', true);
}

function retryDelaySeconds(attempt: number, baseMs: number) {
  return Math.max(1, Math.ceil(Math.min(baseMs * 2 ** Math.max(attempt - 1, 0), 30000) / 1000));
}

export function createReceptionistBookingAdapter(
  dependencies: ReceptionistBookingAdapterDependencies = {},
): ReceptionistBookingAdapter {
  const getConfig = dependencies.getConfig ?? readReceptionistBookingConfig;
  const transport = dependencies.transport ?? fetch;
  const verifyDestination = dependencies.verifyDestination ?? assertPublicReceptionistBookingHost;
  const now = dependencies.now ?? (() => new Date());

  return {
    async execute(rawRequest) {
      const request = receptionistBookingRequestSchema.parse(rawRequest);
      const config = await getConfig();
      if (config.state !== 'ready') {
        return errorResult(request, now(), 'NOT_CONFIGURED', false);
      }
      if (!dependencies.ledger) {
        return errorResult(request, now(), 'PERSISTENCE_UNAVAILABLE', false);
      }

      const fingerprint = requestFingerprint(request);
      let claim: ReceptionistBookingLedgerClaim;
      try {
        claim = await dependencies.ledger.acquire({
          request,
          requestFingerprint: fingerprint,
          leaseMs: config.leaseMs,
          maxAttempts: config.maxAttempts,
        });
      } catch {
        dependencies.reportPersistenceFailure?.('acquire');
        return errorResult(request, now(), 'PERSISTENCE_UNAVAILABLE', true);
      }

      if (claim.kind === 'replay') {
        const parsed = receptionistBookingResultSchema.safeParse(claim.result);
        if (
          !parsed.success ||
          !matchesCorrelation(request, parsed.data) ||
          !isReceptionistBookingResultCompatible(request, parsed.data)
        ) {
          return errorResult(request, now(), 'INVALID_RESPONSE', false);
        }
        if (!isFreshAndUsableResult(parsed.data, now(), config.signatureToleranceSeconds)) {
          return errorResult(request, now(), 'CONFLICT', false);
        }
        return parsed.data;
      }
      if (claim.kind === 'busy') {
        const retryAfterSeconds = claim.retryAfterMs
          ? Math.max(1, Math.ceil(claim.retryAfterMs / 1000))
          : undefined;
        return errorResult(request, now(), 'TEMPORARY_UNAVAILABLE', true, retryAfterSeconds);
      }
      if (claim.kind === 'conflict') {
        return errorResult(request, now(), 'CONFLICT', false);
      }
      if (claim.kind === 'exhausted') {
        return errorResult(request, now(), 'ATTEMPTS_EXHAUSTED', false);
      }

      const persistFailure = async (result: ReceptionistBookingResult, retryAt: Date | null) => {
        try {
          await dependencies.ledger!.fail({
            requestId: request.requestId,
            requestFingerprint: fingerprint,
            leaseToken: claim.leaseToken,
            result,
            retryAt,
          });
          return true;
        } catch {
          dependencies.reportPersistenceFailure?.('fail');
          return false;
        }
      };

      try {
        try {
          await verifyDestination(config.endpoint);
        } catch {
          throw new WorkflowCallError('DESTINATION_REJECTED', false);
        }

        const body = JSON.stringify(request);
        const timestamp = String(Math.floor(now().getTime() / 1000));
        const response = await transport(config.endpoint, {
          method: 'POST',
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(config.timeoutMs),
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-zion-contract-version': RECEPTIONIST_BOOKING_CONTRACT_VERSION,
            'x-zion-timestamp': timestamp,
            'x-zion-signature': signReceptionistBookingBody(body, timestamp, config.requestSecret),
            'x-zion-idempotency-key': request.requestId,
            'x-zion-conversation-id': request.conversationId,
          },
          body,
        });
        if (!response.ok) throw httpFailure(response);
        if (response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
          throw new WorkflowCallError('INVALID_RESPONSE', false);
        }

        const responseBody = await readBoundedBody(response, config.maxResponseBytes);
        const responseTimestamp = response.headers.get('x-zion-timestamp') ?? '';
        const responseSignature = response.headers.get('x-zion-signature') ?? '';
        const responseEpoch = Number(responseTimestamp);
        const currentEpoch = Math.floor(now().getTime() / 1000);
        if (
          !Number.isInteger(responseEpoch) ||
          Math.abs(currentEpoch - responseEpoch) > config.signatureToleranceSeconds ||
          !verifyReceptionistBookingSignature(
            responseBody,
            responseTimestamp,
            responseSignature,
            config.responseSecret,
          )
        ) {
          throw new WorkflowCallError('AUTHENTICATION_FAILED', false);
        }

        let json: unknown;
        try {
          json = JSON.parse(responseBody);
        } catch {
          throw new WorkflowCallError('INVALID_RESPONSE', false);
        }
        const parsedResult = receptionistBookingResultSchema.safeParse(json);
        if (!parsedResult.success) {
          throw new WorkflowCallError('INVALID_RESPONSE', false);
        }
        const result = parsedResult.data;
        if (!matchesCorrelation(request, result)) {
          throw new WorkflowCallError('INVALID_RESPONSE', false);
        }
        if (!isReceptionistBookingResultCompatible(request, result)) {
          throw new WorkflowCallError('INVALID_RESPONSE', false);
        }
        if (!isFreshAndUsableResult(result, now(), config.signatureToleranceSeconds)) {
          throw new WorkflowCallError('INVALID_RESPONSE', false);
        }

        try {
          await dependencies.ledger.complete({
            requestId: request.requestId,
            requestFingerprint: fingerprint,
            leaseToken: claim.leaseToken,
            result,
          });
        } catch {
          dependencies.reportPersistenceFailure?.('complete');
          const persistenceResult = errorResult(request, now(), 'PERSISTENCE_UNAVAILABLE', true);
          await persistFailure(persistenceResult, null);
          return persistenceResult;
        }
        return result;
      } catch (error) {
        const failure = classifyFailure(error);
        const exhausted = claim.attempt >= claim.maxAttempts;
        const retryable = failure.retryable && !exhausted;
        const retryAfterSeconds = retryable
          ? (failure.retryAfterSeconds ?? retryDelaySeconds(claim.attempt, config.retryBaseMs))
          : undefined;
        const result = errorResult(
          request,
          now(),
          exhausted && failure.retryable ? 'ATTEMPTS_EXHAUSTED' : failure.code,
          retryable,
          retryAfterSeconds,
        );
        const retryAt = retryAfterSeconds
          ? new Date(now().getTime() + retryAfterSeconds * 1000)
          : null;
        const recorded = await persistFailure(result, retryAt);
        return recorded ? result : errorResult(request, now(), 'PERSISTENCE_UNAVAILABLE', true);
      }
    },
  };
}
