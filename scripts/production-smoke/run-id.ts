import type { RandomBytes } from './types';

const RUN_ID_BYTES = 16;
const RUN_ID_LENGTH = RUN_ID_BYTES * 2;
const RUN_ID_RE = /^[a-f0-9]{32}$/;

/**
 * Generates a collision-resistant, non-secret `qaRunId`.
 *
 * 16 CSPRNG bytes (128 bits) make concurrent invocations collision-safe
 * without any shared counter or persistence.
 */
export function generateQaRunId(randomBytes: RandomBytes): string {
  const bytes = randomBytes(RUN_ID_BYTES);
  let output = '';
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, '0');
  }
  return output;
}

/** Validates the canonical qaRunId shape (used for overrides). */
export function isValidQaRunId(value: string): boolean {
  return value.length === RUN_ID_LENGTH && RUN_ID_RE.test(value);
}
