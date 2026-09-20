/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchRoutineDetail } from './routine-detail';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const detailPayload = {
  id: 7,
  slug: 'empuje-torso-u1',
  name: 'Empuje y torso superior',
  description: 'Foco en pecho, hombros y tríceps.',
  kind: 'gym',
  restSeconds: 90,
  isSystem: false,
  exercises: [
    {
      id: 1,
      routineId: 7,
      exerciseId: 11,
      sortOrder: 0,
      targetSets: 4,
      targetReps: 8,
      exerciseName: 'Press banca',
      muscleGroup: 'Pecho',
      instructions: 'Bajá con control.',
      imageUrl: null,
      videoUrl: null,
    },
  ],
};

describe('routine detail client', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses routine detail without changing fields', async () => {
    global.fetch = jest.fn(async () => jsonResponse(detailPayload));

    await expect(fetchRoutineDetail(7)).resolves.toEqual(detailPayload);
    expect(global.fetch).toHaveBeenCalledWith('/api/routines/7');
  });

  it('maps 401 responses to unauthorized errors', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    );

    await expect(fetchRoutineDetail(7)).rejects.toMatchObject({
      name: 'RoutineDetailClientError',
      kind: 'unauthorized',
      status: 401,
      api: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
    });
  });

  it('maps 404 responses to not_found errors', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'NOT_FOUND', message: 'Rutina no encontrada' }, 404),
    );

    await expect(fetchRoutineDetail(7)).rejects.toMatchObject({
      name: 'RoutineDetailClientError',
      kind: 'not_found',
      status: 404,
      api: { code: 'NOT_FOUND', message: 'Rutina no encontrada' },
    });
  });

  it('maps invalid success bodies to generic errors', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ id: 7, exercises: 'invalid' }));

    await expect(fetchRoutineDetail(7)).rejects.toMatchObject({
      name: 'RoutineDetailClientError',
      kind: 'generic',
      status: 200,
    });
  });
});
