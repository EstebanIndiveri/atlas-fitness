/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';

import { runSmoke } from './runner';
import { createHarness } from './testing/harness';
import { resetDatabase, seedQaUser, seedSystemRoutineWithExercise } from './testing/seed';
import { TEST_EMAIL, TEST_PASSWORD } from './testing/harness';
import type { InProcessAppOptions } from './testing/in-process-app';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('runSmoke failure handling', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedQaUser(TEST_EMAIL, TEST_PASSWORD);
    await seedSystemRoutineWithExercise();
  });

  it('stops before any request on a deployment host mismatch', async () => {
    const { app, config } = createHarness({
      config: { deploymentUrl: 'https://other.example' },
    });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.targetResult).toEqual({ status: 'FAIL', detail: 'deployment_host_mismatch' });
    expect(app.requests).toHaveLength(0);
  });

  it('rejects a cross-host redirect during login', async () => {
    const intercept: InProcessAppOptions['intercept'] = (_request, url) => {
      if (url.pathname === '/api/auth/login') {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example/steal' },
        });
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.authResult.status).toBe('FAIL');
  });

  it('fails on a malformed API response', async () => {
    const intercept: InProcessAppOptions['intercept'] = (_request, url) => {
      if (url.pathname === '/api/routines') {
        return new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.historyResult.status).toBe('FAIL');
  });

  it('returns INCOMPLETE with retry guidance on HTTP 429', async () => {
    const intercept: InProcessAppOptions['intercept'] = (_request, url) => {
      if (url.pathname === '/api/auth/login') {
        return jsonResponse(429, { code: 'RATE_LIMIT' }, { 'retry-after': '42' });
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('INCOMPLETE');
    expect(evidence.retryAfterSeconds).toBe(42);
    expect(evidence.authResult).toEqual({ status: 'INCOMPLETE', detail: 'rate_limited' });
  });

  it('stops on a workout owned by an unexpected user id', async () => {
    const intercept: InProcessAppOptions['intercept'] = (request, url) => {
      if (url.pathname === '/api/workouts' && request.method === 'POST') {
        return jsonResponse(201, {
          id: 987654,
          userId: 424242,
          routineId: 1,
          note: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
        });
      }
      return null;
    };
    const { app, config } = createHarness({ app: { intercept } });
    const evidence = await runSmoke(config, { fetch: app.fetch });

    expect(evidence.overallResult).toBe('FAIL');
    expect(evidence.historyResult).toEqual({ status: 'FAIL', detail: 'unexpected_user_id' });
  });
});
