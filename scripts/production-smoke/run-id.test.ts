/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import { generateQaRunId, isValidQaRunId } from './run-id';

describe('run-id', () => {
  it('generates a 32-char lowercase hex id from 16 bytes', () => {
    const deterministic = (size: number): Uint8Array =>
      Uint8Array.from({ length: size }, (_, index) => index);
    expect(generateQaRunId(deterministic)).toBe('000102030405060708090a0b0c0d0e0f');
  });

  it('is unique and collision-safe across many generated ids', () => {
    const ids = new Set<string>();
    for (let index = 0; index < 5000; index += 1) {
      ids.add(generateQaRunId((size) => randomBytes(size)));
    }
    expect(ids.size).toBe(5000);
  });

  it('validates the canonical shape used for overrides', () => {
    expect(isValidQaRunId('000102030405060708090a0b0c0d0e0f')).toBe(true);
    expect(isValidQaRunId('ABC')).toBe(false);
    expect(isValidQaRunId('z'.repeat(32))).toBe(false);
  });
});
