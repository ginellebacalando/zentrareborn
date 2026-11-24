import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { readCronSecret } from './config';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/**
 * Accepts only `Authorization: Bearer ${CRON_SECRET}`. Hashing both sides gives equal-length
 * buffers, so the comparison is constant-time and does not reveal the secret length. Without a
 * configured secret every request is rejected.
 */
export function isAuthorizedCronRequest(headers: Headers) {
  const secret = readCronSecret();
  const provided = headers.get('authorization') ?? '';
  const matches = timingSafeEqual(digest(provided), digest(`Bearer ${secret ?? ''}`));
  return secret !== null && matches;
}
