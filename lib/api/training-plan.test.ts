/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createTrainingPlan } from './training-plan';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response;
}

function validBody(): unknown {
  return {
    plan: {
      id: 11,
      userId: 42,
      name: 'Semana base',
      isActive: true,
      createdAt: '2026-09-19T12:00:00.000Z',
      updatedAt: '2026-09-19T12:00:00.000Z',
      deletedAt: null,
    },
    schedule: [
      {
        id: 21,
        trainingPlanId: 11,
        dayOfWeek: 1,
        routineId: 7,
        createdAt: '2026-09-19T12:00:00.000Z',
      },
    ],
  };
}

describe('training plan client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps HTTP 401 to an unauthorized error', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    ) as unknown as typeof fetch;

    await expect(createTrainingPlan({ name: 'Semana base', schedule: [] })).rejects.toMatchObject({
      name: 'TrainingPlanClientError',
      kind: 'unauthorized',
      status: 401,
      api: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
    });
  });

  it('maps HTTP 400 to a validation error', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        { code: 'VALIDATION', message: 'El plan debe tener al menos un día asignado' },
        400,
      ),
    ) as unknown as typeof fetch;

    await expect(createTrainingPlan({ name: 'Semana base', schedule: [] })).rejects.toMatchObject({
      name: 'TrainingPlanClientError',
      kind: 'validation',
      status: 400,
      message: 'El plan debe tener al menos un día asignado',
    });
  });

  it('maps HTTP 404 to a not_found error', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'NOT_FOUND', message: 'Rutina no encontrada' }, 404),
    ) as unknown as typeof fetch;

    await expect(createTrainingPlan({ name: 'Semana base', schedule: [] })).rejects.toMatchObject({
      name: 'TrainingPlanClientError',
      kind: 'not_found',
      status: 404,
      message: 'Rutina no encontrada',
    });
  });

  it('posts JSON and parses a valid response body', async () => {
    const payload = validBody();
    global.fetch = jest.fn(async () => jsonResponse(payload)) as unknown as typeof fetch;

    await expect(
      createTrainingPlan({ name: 'Semana base', schedule: [{ dayOfWeek: 1, routineId: 7 }] }),
    ).resolves.toEqual({
      plan: {
        id: 11,
        userId: 42,
        name: 'Semana base',
        isActive: true,
        createdAt: new Date('2026-09-19T12:00:00.000Z'),
        updatedAt: new Date('2026-09-19T12:00:00.000Z'),
        deletedAt: null,
      },
      schedule: [
        {
          id: 21,
          trainingPlanId: 11,
          dayOfWeek: 1,
          routineId: 7,
          createdAt: new Date('2026-09-19T12:00:00.000Z'),
        },
      ],
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/training-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Semana base',
        schedule: [{ dayOfWeek: 1, routineId: 7 }],
      }),
    });
  });

  it('throws a generic error when a successful response body is invalid', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ plan: { id: 11, userId: 42, name: 'Semana base' }, schedule: [] }),
    ) as unknown as typeof fetch;

    await expect(
      createTrainingPlan({ name: 'Semana base', schedule: [{ dayOfWeek: 1, routineId: 7 }] }),
    ).rejects.toMatchObject({ kind: 'generic', name: 'TrainingPlanClientError' });
  });

  it('throws a generic error when a successful response body is malformed JSON', async () => {
    global.fetch = jest.fn(async () => textResponse('not-json')) as unknown as typeof fetch;

    await expect(
      createTrainingPlan({ name: 'Semana base', schedule: [{ dayOfWeek: 1, routineId: 7 }] }),
    ).rejects.toMatchObject({ kind: 'generic', name: 'TrainingPlanClientError' });
  });
});
