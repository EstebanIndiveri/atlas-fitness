/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createRoutine, fetchRoutine, RoutineClientError } from './client';
import { ROUTINE_COPY } from '@/lib/copy/routines';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('routines client', () => {
  it('loads a routine from GET /api/routines/:id', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 3,
          slug: 'own',
          name: 'Mía',
          description: null,
          kind: 'home',
          restSeconds: 20,
          isSystem: false,
          exercises: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const routine = await fetchRoutine(3);
    expect(routine.name).toBe('Mía');
    expect(routine.isSystem).toBe(false);
  });

  it('maps GET 404 to not-found without extra payload', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'NOT_FOUND', message: 'Rutina no encontrada' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(fetchRoutine(99)).rejects.toMatchObject({
      name: 'RoutineClientError',
      kind: 'not_found',
      message: ROUTINE_COPY.notFound,
    } satisfies Partial<RoutineClientError>);
  });

  it('maps POST 405 to the documented write gap', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 405 }));

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
