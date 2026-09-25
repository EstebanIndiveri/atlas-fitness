import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  createTrainingPlanImprovementReceipt,
  verifyTrainingPlanImprovementReceipt,
} from '@/lib/services/training-plan-improvement-receipt';

const originalSessionSecret = process.env.SESSION_SECRET;
const TEST_SECRET = 'test-plan-improvement-session-secret';
const receiptInput = {
  version: 1 as const,
  userId: 42,
  planId: 11,
  intent: 'Reducir volumen',
  expectedPlanUpdatedAt: '2026-09-25T10:00:00.000Z',
  currentPlanHash: 'a'.repeat(64),
  proposalHash: 'b'.repeat(64),
  replacePlanStateHash: 'c'.repeat(64),
  routineKindsByDay: [{ dayOfWeek: 1 as const, kind: 'gym' as const }],
  defaultRoutineKind: 'gym' as const,
};

describe('training-plan improvement receipt', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
  });

  it('issues a unique, integrity-protected receipt with an expiry', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00.000Z'));

    const firstToken = createTrainingPlanImprovementReceipt(receiptInput);
    const secondToken = createTrainingPlanImprovementReceipt(receiptInput);
    const claims = verifyTrainingPlanImprovementReceipt(firstToken);

    expect(secondToken).not.toBe(firstToken);
    expect(claims).toMatchObject(receiptInput);
    expect(claims.nonce).toMatch(/^[\da-f-]{36}$/i);
    expect(Date.parse(claims.expiresAt) - Date.now()).toBe(60 * 60 * 1000);
  });

  it('rejects an expired receipt', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00.000Z'));
    const token = createTrainingPlanImprovementReceipt(receiptInput);
    jest.advanceTimersByTime(60 * 60 * 1000 + 1);

    expect(() => verifyTrainingPlanImprovementReceipt(token)).toThrow(
      'La propuesta no es válida para este plan.',
    );
  });
});
