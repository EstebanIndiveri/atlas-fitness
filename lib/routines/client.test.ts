/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createRoutine, fetchRoutine } from './client';
import { ROUTINE_COPY } from '@/lib/copy/routines';

function jsonResponse(body: unknown, status = 200): Response {
  const payload = body === null || body === '' ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => payload,
  } as Response;
}

describe('routines client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads a routine from GET /api/routines/:id', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        id: 3,
        slug: 'own',
        name: 'Mía',
        description: null,
        kind: 'home',
        restSeconds: 20,
        isSystem: false,
        exercises: [],
      }),
    ) as unknown as typeof fetch;

    const routine = await fetchRoutine(3);
    expect(routine.name).toBe('Mía');
    expect(routine.isSystem).toBe(false);
  });

  it('maps GET 404 to not-found without extra payload', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'NOT_FOUND', message: 'Rutina no encontrada' }, 404),
    ) as unknown as typeof fetch;

    await expect(fetchRoutine(99)).rejects.toMatchObject({
      name: 'RoutineClientError',
      kind: 'not_found',
      message: ROUTINE_COPY.notFound,
    });
  });

  it('maps POST 405 to the documented write gap', async () => {
    global.fetch = jest.fn(async () => jsonResponse('', 405)) as unknown as typeof fetch;

    await expect(
      createRoutine({
        name: 'Empuje',
        kind: 'gym',
        exercises: [{ exerciseId: 1, sortOrder: 0, targetSets: 3, targetReps: 8 }],
      }),
    ).rejects.toMatchObject({
      kind: 'write_unavailable',
      message: ROUTINE_COPY.errorWriteUnavailable,
    });
  });
});
