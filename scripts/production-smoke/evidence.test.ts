/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { buildEvidence, findLeaks, serializeEvidence, step } from './evidence';
import type { SmokeEvidence } from './types';

const SAMPLE_NOTE = 'ATLAS_SMOKE_NOTE:deadbeef';
const SAMPLE_COOKIE = 'session=abc.def.ghi';

function sampleEvidence(): SmokeEvidence {
  const pass = step('PASS');
  return buildEvidence({
    qaRunId: 'deadbeefdeadbeefdeadbeefdeadbeef',
    expectedReleaseSha: 'abc',
    actualReleaseSha: 'abc',
    deploymentId: '1',
    deploymentEnvironment: 'Production',
    deploymentUrl: 'https://prod.example',
    workflowRunId: '99',
    startedAt: '2026-09-30T00:00:00.000Z',
    completedAt: '2026-09-30T00:01:00.000Z',
    targetResult: pass,
    authResult: pass,
    reauthResult: pass,
    historyResult: pass,
    noteResult: pass,
    casResult: pass,
    cleanupResult: pass,
    retryAfterSeconds: null,
    recoveredOrphans: 0,
    knownQaIdentityResidualState: { longestStreak: 3 },
    overallResult: 'PASS',
  });
}

describe('evidence', () => {
  it('carries the schema version and required fields', () => {
    const evidence = sampleEvidence();
    expect(evidence.schemaVersion).toBe(1);
    expect(Object.keys(evidence)).toEqual(
      expect.arrayContaining([
        'qaRunId',
        'expectedReleaseSha',
        'actualReleaseSha',
        'deploymentId',
        'deploymentEnvironment',
        'deploymentUrl',
        'workflowRunId',
        'startedAt',
        'completedAt',
        'authResult',
        'reauthResult',
        'historyResult',
        'noteResult',
        'casResult',
        'cleanupResult',
        'knownQaIdentityResidualState',
        'overallResult',
      ]),
    );
  });

  it('contains none of the forbidden secret material', () => {
    const serialized = serializeEvidence(sampleEvidence());
    expect(findLeaks(serialized, [SAMPLE_NOTE, SAMPLE_COOKIE, 'SuperSecret1'])).toEqual([]);
  });

  it('detects secret values and forbidden header literals', () => {
    const serialized = `${serializeEvidence(sampleEvidence())}\nSet-Cookie: ${SAMPLE_COOKIE}`;
    expect(findLeaks(serialized, [SAMPLE_COOKIE])).toContain('secret[0]');
    expect(findLeaks(serialized, [])).toContain('set-cookie');
  });

  it('records the accepted longestStreak residual only', () => {
    const evidence = sampleEvidence();
    expect(evidence.knownQaIdentityResidualState).toEqual({ longestStreak: 3 });
  });
});
