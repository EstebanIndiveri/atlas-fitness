import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AppError } from '@/types/errors';
import type { RoutineSummary } from '@/types/routine';

type GetRoutineById = typeof import('@/lib/services/routines')['getRoutineById'];
type GetTodayCheckIn = typeof import('@/lib/services/daily-checkin')['getTodayCheckIn'];

const mockGetRoutineById = jest.fn<GetRoutineById>();
const mockGetTodayCheckIn = jest.fn<GetTodayCheckIn>();

jest.mock('@/lib/services/routines', () => ({
  getRoutineById: mockGetRoutineById,
}));

jest.mock('@/lib/services/daily-checkin', () => ({
  getTodayCheckIn: mockGetTodayCheckIn,
}));

let previewCoachAdaptation: typeof import('./coach-preview')['previewCoachAdaptation'];

const routine: RoutineSummary = {
  id: 10,
  slug: 'full-body-u1',
  name: 'Full body',
  description: null,
  kind: 'gym',
  restSeconds: 90,
  isSystem: false,
  exercises: [
    {
      id: 1,
      routineId: 10,
      exerciseId: 101,
      sortOrder: 0,
      targetSets: 4,
      targetReps: 8,
      exerciseName: 'Sentadilla',
      muscleGroup: 'Piernas',
      instructions: 'Bajar controlado',
      imageUrl: null,
      videoUrl: null,
    },
    {
      id: 2,
      routineId: 10,
      exerciseId: 102,
      sortOrder: 1,
      targetSets: 3,
      targetReps: 10,
      exerciseName: 'Press banca',
      muscleGroup: 'Pecho',
      instructions: 'Pausar abajo',
      imageUrl: null,
      videoUrl: null,
    },
    {
      id: 3,
      routineId: 10,
      exerciseId: 103,
      sortOrder: 2,
      targetSets: 3,
      targetReps: 12,
      exerciseName: 'Curl bíceps',
      muscleGroup: 'Brazos',
      instructions: 'Sin balanceo',
      imageUrl: null,
      videoUrl: null,
    },
  ],
};

describe('previewCoachAdaptation service', () => {
  beforeAll(async () => {
    const module = await import('./coach-preview');
    previewCoachAdaptation = module.previewCoachAdaptation;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoutineById.mockResolvedValue(routine);
    mockGetTodayCheckIn.mockResolvedValue(null);
  });

  it('returns an explainable deterministic preview with explicit energy and mood without loading check-in', async () => {
    const result = await previewCoachAdaptation(
      {
        routineId: 10,
        userId: 1,
        trainingPlanId: 31,
        energy: 'high',
        mood: 4,
        freeText: ' Mantener técnica ',
      },
      { generateContent: async () => null },
    );

    expect(mockGetRoutineById).toHaveBeenCalledWith(10, 1, 31);
    expect(mockGetTodayCheckIn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      original: { exerciseCount: 3, setCount: 10, estMinutes: 30 },
      adapted: { exerciseCount: 3, setCount: 10, estMinutes: 30 },
      source: 'deterministic',
    });
    expect(result.exerciseDeltas).toEqual([
      { exerciseId: 101, name: 'Sentadilla', action: 'kept', fromSets: 4, toSets: 4 },
      { exerciseId: 102, name: 'Press banca', action: 'kept', fromSets: 3, toSets: 3 },
      { exerciseId: 103, name: 'Curl bíceps', action: 'kept', fromSets: 3, toSets: 3 },
    ]);
  });

  it('falls back to today check-in when energy and mood are omitted', async () => {
    mockGetTodayCheckIn.mockResolvedValue({
      id: 5,
      userId: 1,
      localDate: '2026-09-19',
      mood: 2,
      energy: 'low',
      note: null,
      createdAt: new Date('2026-09-19T10:00:00.000Z'),
      updatedAt: new Date('2026-09-19T10:00:00.000Z'),
    });

    const result = await previewCoachAdaptation(
      { routineId: 10, userId: 1 },
      { generateContent: async () => null },
    );

    expect(mockGetTodayCheckIn).toHaveBeenCalledWith(1);
    expect(result.original.setCount).toBe(10);
    expect(result.adapted.setCount).toBeLessThan(result.original.setCount);
    expect(result.reason).toContain('energía baja');
  });

  it('rejects free-text-only previews instead of inventing neutral energy and mood', async () => {
    await expect(
      previewCoachAdaptation(
        { routineId: 10, userId: 1, freeText: 'Tengo 15 minutos' },
        { generateContent: async () => null },
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Necesitás registrar tu check-in de hoy o indicar energía y ánimo para adaptar.',
    });

    expect(mockGetTodayCheckIn).toHaveBeenCalledWith(1);
  });

  it('rejects free-text previews when the check-in is missing energy', async () => {
    mockGetTodayCheckIn.mockResolvedValue({
      id: 5,
      userId: 1,
      localDate: '2026-09-19',
      mood: 3,
      energy: null,
      note: null,
      createdAt: new Date('2026-09-19T10:00:00.000Z'),
      updatedAt: new Date('2026-09-19T10:00:00.000Z'),
    });

    await expect(
      previewCoachAdaptation(
        { routineId: 10, userId: 1, freeText: 'Tengo 15 minutos' },
        { generateContent: async () => null },
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Necesitás registrar tu check-in de hoy o indicar energía y ánimo para adaptar.',
    });
  });

  it('throws VALIDATION when no real energy or mood source is available', async () => {
    mockGetTodayCheckIn.mockResolvedValue({
      id: 5,
      userId: 1,
      localDate: '2026-09-19',
      mood: 3,
      energy: null,
      note: null,
      createdAt: new Date('2026-09-19T10:00:00.000Z'),
      updatedAt: new Date('2026-09-19T10:00:00.000Z'),
    });

    await expect(previewCoachAdaptation({ routineId: 10, userId: 1 })).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Necesitás registrar tu check-in de hoy o indicar energía y ánimo para adaptar.',
    });
  });

  it('propagates NOT_FOUND from routine ownership checks', async () => {
    mockGetRoutineById.mockRejectedValue(new AppError('NOT_FOUND', 'Rutina no encontrada'));

    await expect(
      previewCoachAdaptation({ routineId: 10, userId: 2, energy: 'medium', mood: 3 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Rutina no encontrada' });
  });

  it('throws VALIDATION for invalid boundary input', async () => {
    await expect(previewCoachAdaptation({ routineId: -1, userId: 1 })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(mockGetRoutineById).not.toHaveBeenCalled();
  });
});
