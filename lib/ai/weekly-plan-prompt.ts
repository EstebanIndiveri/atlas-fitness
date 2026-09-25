import type { ExerciseCatalogItem } from '@/types/exercise';

import type { WeeklyPlanDraftInput } from './weekly-plan-draft';

/**
 * Builds the Gemini prompt for a weekly plan draft using only user parameters and catalog metadata.
 *
 * @param input User training preferences and authenticated exercise catalog.
 * @param normalizedGoal Goal already normalized to the persistence-safe server limit.
 * @param days Number of training days already clamped to the supported weekly range.
 * @returns A Spanish, JSON-only prompt that requires catalog exercise ids.
 * @example
 * buildWeeklyPlanPrompt(input, 'ganar fuerza', 3);
 */
export function buildWeeklyPlanPrompt(
  input: WeeklyPlanDraftInput,
  normalizedGoal: string,
  days: number,
): string {
  const catalogPayload = input.catalog.map((item: ExerciseCatalogItem) => ({
    id: item.id,
    name: item.name,
    muscleGroup: item.muscleGroup,
  }));
  const prompt = [
    'Sos Coach Atlas. Respondé SOLO JSON válido con esta forma:',
    '{"name":"string","goal":"string","days":[{"dayOfWeek":0,"title":"string","focus":"string","exercises":[{"exerciseId":number,"targetSets":number,"targetReps":number}]}]}',
    'dayOfWeek usa 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado.',
    'Elegí exerciseId SOLO del catálogo recibido. No inventes ids ni ejercicios.',
    'Cada día debe tener ejercicios y foco claros; series y repeticiones son objetivos orientativos, no una duración validada.',
    'No afirmes biometría, resultados garantizados ni compatibilidad segura de equipo. No agregues explicaciones ajenas al brief y a los ejercicios/objetivos propuestos.',
    `Objetivo: ${normalizedGoal}`,
    `Días por semana: ${days}`,
    `Nivel/experiencia: ${input.experience}`,
    `Equipamiento/ubicación: ${input.availableEquipment.join(', ') || 'sin equipamiento informado'}`,
    `Duración por sesión: ${input.sessionLengthMinutes} minutos`,
    `Áreas foco: ${input.focusAreas.join(', ') || 'equilibrado'}`,
    `Catálogo: ${JSON.stringify(catalogPayload)}`,
  ];
  if (input.currentPlan) {
    prompt.push(
      'Estás proponiendo una mejora para un plan semanal existente. Usá solo los datos actuales provistos y atendé explícitamente el objetivo pedido.',
      'No afirmes que modificaste rutinas existentes. La propuesta se revisará y solo se guardará si la persona confirma.',
      `Plan semanal actual: ${JSON.stringify(input.currentPlan)}`,
    );
  }
  return prompt.join('\n');
}
