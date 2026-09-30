import { SmokeStop, type SmokeField } from './smoke-stop';
import type { HttpResult } from './types';

/** Single mapping for every HTTP status decision in the runner. */
export interface HttpStatusDecision {
  outcome: 'ok' | 'incomplete' | 'fail';
  detail: string;
  retryAfterSeconds: number | null;
}

/** Reads `Retry-After` seconds without echoing the raw header value. */
export function retryAfterSeconds(result: HttpResult): number | null {
  const header = result.headers.get('retry-after');
  if (!header) {
    return null;
  }
  const parsed = Number.parseInt(header, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Classifies a response against the expected statuses.
 *
 * `429` is always `INCOMPLETE` (with retry guidance); an expected status is
 * `ok`; anything else is `FAIL`. Every status decision in the runner routes
 * through this helper (architecture §4/§6).
 */
export function decideHttpStatus(
  result: HttpResult,
  expected: readonly number[],
  label: string,
): HttpStatusDecision {
  if (result.status === 429) {
    return {
      outcome: 'incomplete',
      detail: 'rate_limited',
      retryAfterSeconds: retryAfterSeconds(result),
    };
  }
  if (expected.includes(result.status)) {
    return { outcome: 'ok', detail: label, retryAfterSeconds: null };
  }
  return {
    outcome: 'fail',
    detail: `${label}: unexpected_status_${result.status}`,
    retryAfterSeconds: null,
  };
}

/** Throws a `SmokeStop` unless the status is expected (`429` -> INCOMPLETE). */
export function requireHttpStatus(
  result: HttpResult,
  expected: readonly number[],
  field: SmokeField,
  label: string,
): void {
  const decision = decideHttpStatus(result, expected, label);
  if (decision.outcome === 'ok') {
    return;
  }
  throw new SmokeStop(
    field,
    decision.outcome === 'incomplete' ? 'INCOMPLETE' : 'FAIL',
    decision.detail,
    decision.retryAfterSeconds,
  );
}
