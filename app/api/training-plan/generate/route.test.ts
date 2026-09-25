/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { rateLimitBuckets } from '@/lib/db/schema';
import type { WeeklyPlanDraft, WeeklyPlanDraftInput } from '@/lib/ai/weekly-plan-draft';
import type { SessionData } from '@/types/auth';
import type { ExerciseCatalogItem } from '@/types/exercise';
import { AppError } from '@/types/errors';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type ListExercises = typeof import('@/lib/services/exercises')['listExercises'];
type GenerateWeeklyPlanDraft = typeof import('@/lib/ai/weekly-plan-draft')['generateWeeklyPlanDraft'];

const mockRequireAuth = jest.fn<RequireAuth>();
const mockListExercises = jest.fn<ListExercises>();
const mockGenerateWeeklyPlanDraft = jest.fn<GenerateWeeklyPlanDraft>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return { ...actual, requireAuth: mockRequireAuth };
});

jest.mock('@/lib/services/exercises', () => ({
  listExercises: mockListExercises,
}));

jest.mock('@/lib/ai/weekly-plan-draft', () => ({
  generateWeeklyPlanDraft: mockGenerateWeeklyPlanDraft,
}));

let POST: typeof import('./route')['POST'];

const catalog: ExerciseCatalogItem[] = [
  {
    id: 7,
    slug: 'sentadilla',
    name: 'Sentadilla',
    muscleGroup: 'Piernas',
    instructions: 'Bajá con control.',
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
  },
];

const validBrief = {
  goal: 'ganar fuerza',
  daysPerWeek: 3,
  experience: 'intermediate',
  availableEquipment: ['gimnasio'],
  sessionLengthMinutes: 55,
  focusAreas: ['piernas'],
} satisfies Omit<WeeklyPlanDraftInput, 'catalog'>;

const generatedDraft: WeeklyPlanDraft = {
  source: 'gemini',
  name: 'Semana de fuerza',
  goal: validBrief.goal,
  days: [{
    dayOfWeek: 1,
    title: 'Día 1',
    focus: 'Piernas',
    exercises: [{
      exerciseId: 7,
      exerciseName: 'Sentadilla',
      muscleGroup: 'Piernas',
      sortOrder: 0,
      targetSets: 3,
      targetReps: 8,
    }],
  }],
};

function request(body: unknown, ip = '203.0.113.42'): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function malformedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"goal":',
  });
}

function session(userId: number): SessionData {
  return { userId, sessionId: `session-${userId}`, iat: 1, exp: 9999999999 };
}

describe('POST /api/training-plan/generate', () => {
  beforeAll(async () => {
    POST = (await import('./route')).POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(session(42));
    mockListExercises.mockResolvedValue(catalog);
    mockGenerateWeeklyPlanDraft.mockResolvedValue(generatedDraft);
  });

  beforeEach(async () => {
    await db.delete(rateLimitBuckets);
  });

  it('requires authentication before reading the catalog or generating a draft', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await POST(request(validBrief));

    expect(response.status).toBe(401);
    expect(mockListExercises).not.toHaveBeenCalled();
    expect(mockGenerateWeeklyPlanDraft).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with the shared validation response', async () => {
    const response = await POST(malformedRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it.each([
    ['short goal', { ...validBrief, goal: 'x' }],
    ['long goal', { ...validBrief, goal: 'g'.repeat(61) }],
    ['zero days', { ...validBrief, daysPerWeek: 0 }],
    ['more than six days', { ...validBrief, daysPerWeek: 7 }],
    ['unknown experience', { ...validBrief, experience: 'expert' }],
    ['session shorter than 20 minutes', { ...validBrief, sessionLengthMinutes: 19 }],
    ['session longer than 120 minutes', { ...validBrief, sessionLengthMinutes: 121 }],
    ['too many equipment entries', { ...validBrief, availableEquipment: Array(9).fill('equipo') }],
    ['oversized equipment entry', { ...validBrief, availableEquipment: ['e'.repeat(41)] }],
    ['too many focus entries', { ...validBrief, focusAreas: Array(7).fill('foco') }],
    ['oversized focus entry', { ...validBrief, focusAreas: ['f'.repeat(41)] }],
  ])('rejects a brief with %s', async (_caseName, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
    expect(mockListExercises).not.toHaveBeenCalled();
    expect(mockGenerateWeeklyPlanDraft).not.toHaveBeenCalled();
  });

  it('generates from the authenticated user catalog and returns the generator source', async () => {
    const body = {
      ...validBrief,
      catalog: [{ id: 999, name: 'untrusted exercise' }],
      userId: 999,
    };

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(generatedDraft);
    expect(mockListExercises).toHaveBeenCalledWith(42);
    expect(mockGenerateWeeklyPlanDraft).toHaveBeenCalledWith(
      { ...validBrief, catalog },
    );
  });

  it('rejects generation when the caller-visible catalog is empty', async () => {
    mockListExercises.mockResolvedValue([]);

    const response = await POST(request(validBrief));

    expect(response.status).toBe(400);
    expect(mockGenerateWeeklyPlanDraft).not.toHaveBeenCalled();
  });

  it('uses a durable per-user/IP quota and returns typed 429 before generating another draft', async () => {
    const previousLimit = process.env.WEEKLY_PLAN_GENERATE_PER_MINUTE;
    process.env.WEEKLY_PLAN_GENERATE_PER_MINUTE = '1';
    const ip = '203.0.113.88';
    try {
      const allowed = await POST(request(validBrief, ip));
      const blocked = await POST(request(validBrief, ip));

      expect(allowed.status).toBe(200);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('Retry-After')).toMatch(/^[1-9]\d*$/);
      await expect(blocked.json()).resolves.toEqual({
        code: 'RATE_LIMIT',
        message: 'Se alcanzó el límite de propuestas. Probá de nuevo en un minuto.',
      });
      expect(mockGenerateWeeklyPlanDraft).toHaveBeenCalledTimes(1);
      expect(mockListExercises).toHaveBeenCalledTimes(1);

      const [bucket] = await db
        .select({ count: rateLimitBuckets.count })
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.key, 'weekly-plan-generate:42:203.0.113.88'))
        .limit(1);
      expect(bucket?.count).toBe(2);
    } finally {
      if (previousLimit === undefined) {
        delete process.env.WEEKLY_PLAN_GENERATE_PER_MINUTE;
      } else {
        process.env.WEEKLY_PLAN_GENERATE_PER_MINUTE = previousLimit;
      }
    }
  });
});
