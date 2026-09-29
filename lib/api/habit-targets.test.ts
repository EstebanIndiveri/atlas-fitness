/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  deactivateHabitTarget,
  fetchHabitTargets,
  saveHabitTarget,
  HabitTargetClientError,
} from './habit-targets';
import type { HabitTargetResponse } from './habit-targets';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(text: string, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as Response;
}

const target: HabitTargetResponse = {
  id: 7,
  userId: 3,
  habitKey: 'walk',
  effectiveFrom: '2026-09-24',
  effectiveTo: null,
  version: 1,
  weekdays: [1, 3],
  createdAt: '2026-09-24T15:00:00.000Z',
  updatedAt: '2026-09-24T15:00:00.000Z',
};

const FETCH_MESSAGE = 'No se pudieron cargar tus objetivos de hábitos';
const SAVE_MESSAGE = 'No se pudo guardar el objetivo de hábito';
const DEACTIVATE_MESSAGE = 'No se pudo desactivar el objetivo de hábito';

describe('habit-targets client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses the current targets and requests the collection endpoint', async () => {
    global.fetch = jest.fn(async () => jsonResponse([target])) as unknown as typeof fetch;

    await expect(fetchHabitTargets()).resolves.toEqual([target]);
    expect(global.fetch).toHaveBeenCalledWith('/api/habit-targets');
  });

  it('accepts an empty target list', async () => {
    global.fetch = jest.fn(async () => jsonResponse([])) as unknown as typeof fetch;

    await expect(fetchHabitTargets()).resolves.toEqual([]);
  });

  it.each([
    ['unknown habit key', { ...target, habitKey: 'cardio' }],
    ['non-canonical effectiveFrom', { ...target, effectiveFrom: '2026-02-31' }],
    ['range ending before it starts', { ...target, effectiveFrom: '2026-09-24', effectiveTo: '2026-09-20' }],
    ['empty weekday list', { ...target, weekdays: [] }],
    ['duplicated weekday', { ...target, weekdays: [1, 1] }],
    ['eight weekdays', { ...target, weekdays: [0, 1, 2, 3, 4, 5, 6, 0] }],
    ['weekday out of range', { ...target, weekdays: [7] }],
    ['fractional weekday', { ...target, weekdays: [1.5] }],
    ['zero version', { ...target, version: 0 }],
    ['missing timestamps', { ...target, updatedAt: undefined }],
  ])('rejects a target with %s', async (_label, payload) => {
    global.fetch = jest.fn(async () => jsonResponse([payload])) as unknown as typeof fetch;

    await expect(fetchHabitTargets()).rejects.toMatchObject({
      name: 'HabitTargetClientError',
      kind: 'generic',
      message: FETCH_MESSAGE,
    });
  });

  it('rejects a non-array payload and an empty body', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ targets: [target] })) as unknown as typeof fetch;
    await expect(fetchHabitTargets()).rejects.toMatchObject({ kind: 'generic' });

    global.fetch = jest.fn(async () => textResponse('', 200)) as unknown as typeof fetch;
    await expect(fetchHabitTargets()).rejects.toMatchObject({ kind: 'generic' });
  });

  it('sends a create PUT with the null token and parses the target', async () => {
    global.fetch = jest.fn(async () => jsonResponse(target, 201)) as unknown as typeof fetch;

    await expect(
      saveHabitTarget('walk', [1, 3], { expectedTargetId: null, expectedVersion: null }),
    ).resolves.toEqual(target);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/habit-targets/walk',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ weekdays: [1, 3], expectedTargetId: null, expectedVersion: null }),
      }),
    );
  });

  it('rejects a successful PUT whose body is not a target', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ nope: true }, 200)) as unknown as typeof fetch;

    await expect(
      saveHabitTarget('walk', [1], { expectedTargetId: 7, expectedVersion: 2 }),
    ).rejects.toMatchObject({ kind: 'generic', message: SAVE_MESSAGE });
  });

  it('sends a DELETE with the token and parses the absent post-state', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ activeTarget: null })) as unknown as typeof fetch;

    await expect(
      deactivateHabitTarget('walk', { expectedTargetId: 7, expectedVersion: 2 }),
    ).resolves.toEqual({ activeTarget: null });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/habit-targets/walk',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ expectedTargetId: 7, expectedVersion: 2 }),
      }),
    );
  });

  it('rejects a DELETE body that is not the explicit absent state', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ activeTarget: target })) as unknown as typeof fetch;

    await expect(
      deactivateHabitTarget('walk', { expectedTargetId: 7, expectedVersion: 2 }),
    ).rejects.toMatchObject({ kind: 'generic', message: DEACTIVATE_MESSAGE });
  });

  it.each([
    [401, { code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 'unauthorized'],
    [400, { code: 'VALIDATION', message: 'Objetivo de hábito inválido' }, 'validation'],
    [404, { code: 'NOT_FOUND', message: 'Hábito no encontrado' }, 'not_found'],
    [409, { code: 'CONFLICT', message: 'El objetivo de hábito cambió.' }, 'conflict'],
  ] as const)('maps a %i response to the %s client error kind', async (status, body, kind) => {
    global.fetch = jest.fn(async () => jsonResponse(body, status)) as unknown as typeof fetch;

    await expect(fetchHabitTargets()).rejects.toMatchObject({
      name: 'HabitTargetClientError',
      kind,
      status,
      api: body,
    });
  });

  it('maps an unreadable error body to a generic client error', async () => {
    global.fetch = jest.fn(async () => textResponse('<html>502</html>', 502)) as unknown as typeof fetch;

    await expect(fetchHabitTargets()).rejects.toMatchObject({
      kind: 'generic',
      status: 502,
      api: null,
      message: FETCH_MESSAGE,
    });
  });

  it('preserves the client error type and message for callers', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ nope: true })) as unknown as typeof fetch;

    const error = await fetchHabitTargets().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HabitTargetClientError);
    expect(error).toBeInstanceOf(Error);
    expect((error as HabitTargetClientError).message).toBe(FETCH_MESSAGE);
  });
});
