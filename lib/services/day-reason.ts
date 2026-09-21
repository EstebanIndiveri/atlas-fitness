export type DayReasonEnergy = 'low' | 'medium' | 'high';

export interface BuildDayReasonInput {
  energy: DayReasonEnergy | null;
  mood: number | null;
  restedYesterday: boolean;
  goal: string | null;
}

function goalLabel(goal: string | null): string {
  const trimmed = goal?.trim();
  return trimmed ? trimmed : 'entrenamiento';
}

/**
 * Builds a deterministic, data-honest reason for today's planned workout.
 *
 * @param input - Real day context: today's check-in energy/mood when present, whether yesterday had no ended workout, and the active plan goal.
 * @returns A short es-AR sentence for the Today hero, never based on user-authored plan notes.
 * @example
 * buildDayReason({ energy: 'low', mood: 2, restedYesterday: false, goal: 'Fuerza' });
 */
export function buildDayReason(input: BuildDayReasonInput): string {
  if (input.energy === null && input.mood === null) {
    return 'Registrá tu check-in para que Atlas ajuste la sesión de hoy.';
  }

  if (input.energy === 'low') {
    return 'Registraste energía baja: si querés, adaptá con Coach Atlas para bajar volumen.';
  }

  if (input.energy === 'high' && input.restedYesterday) {
    return 'Marcaste energía alta y ayer descansaste: buen día para la sesión prevista sin recortes.';
  }

  return `Sesión de ${goalLabel(input.goal)} prevista para hoy. Ajustá con Coach Atlas si tu día cambió.`;
}
