import { describe, expect, it } from '@jest/globals';

import { generateWeeklyPlanDraft } from './weekly-plan-draft';
import type { WeeklyPlanDraftInput } from './weekly-plan-draft';
import type { ExerciseCatalogItem } from '@/types/exercise';

function exercise(id: number, name: string, muscleGroup: string): ExerciseCatalogItem {
  return {
    id,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    muscleGroup,
    instructions: `Hacé ${name} con técnica controlada.`,
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
  };
}

const catalog: ExerciseCatalogItem[] = [
  exercise(1, 'Press banca', 'Pecho'),
  exercise(2, 'Remo con barra', 'Espalda'),
  exercise(3, 'Sentadilla', 'Piernas'),
  exercise(4, 'Press militar', 'Hombros'),
  exercise(5, 'Peso muerto rumano', 'Isquios'),
  exercise(6, 'Curl bíceps', 'Bíceps'),
  exercise(7, 'Plancha', 'Core'),
  exercise(8, 'Zancadas', 'Glúteos'),
];

function input(daysPerWeek: number, overrides: Partial<WeeklyPlanDraftInput> = {}): WeeklyPlanDraftInput {
  return {
    goal: 'ganar fuerza sin perder movilidad',
    daysPerWeek,
    experience: 'intermediate',
    availableEquipment: ['gimnasio completo'],
    sessionLengthMinutes: 55,
    focusAreas: ['pecho', 'espalda', 'piernas'],
    catalog,
    ...overrides,
  };
}

describe('generateWeeklyPlanDraft', () => {
  it.each([3, 4, 5])(
    'returns %i deterministic days with distinct focuses and non-empty exercises',
    async (daysPerWeek) => {
      const first = await generateWeeklyPlanDraft(input(daysPerWeek));
      const second = await generateWeeklyPlanDraft(input(daysPerWeek));

      expect(first).toEqual(second);
      expect(first.days).toHaveLength(daysPerWeek);
      expect(new Set(first.days.map((day) => day.focus)).size).toBe(daysPerWeek);
      expect(first.days.every((day) => day.exercises.length > 0)).toBe(true);
      expect(first.goal).toBe('ganar fuerza sin perder movilidad');
      expect(first.name).toContain('Coach Atlas');
    },
  );

  it('keeps the minimum of one training day', async () => {
    const draft = await generateWeeklyPlanDraft(input(0));

    expect(draft.days).toHaveLength(1);
    expect(draft.days[0]?.dayOfWeek).toBe(1);
  });

  it('clamps large plans to six days', async () => {
    const draft = await generateWeeklyPlanDraft(input(9));

    expect(draft.days).toHaveLength(6);
    expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('uses an honest fallback goal when the user goal is blank', async () => {
    const draft = await generateWeeklyPlanDraft(input(3, { goal: '   ' }));

    expect(draft.goal).toBe('mejorar condición general');
    expect(draft.name).toContain('condición general');
  });

  it('caps long goals to the server limit before persistence', async () => {
    const longGoal = 'ganar fuerza manteniendo movilidad y cuidando rodillas con sesiones progresivas';
    const draft = await generateWeeklyPlanDraft(input(3, { goal: longGoal }));

    expect(draft.goal).toHaveLength(60);
    expect(draft.goal).toBe(longGoal.slice(0, 60).trim());
  });

  it('throws when the catalog is empty', async () => {
    await expect(generateWeeklyPlanDraft(input(3, { catalog: [] }))).rejects.toThrow(
      'No hay ejercicios disponibles para armar un plan semanal.',
    );
  });
});
