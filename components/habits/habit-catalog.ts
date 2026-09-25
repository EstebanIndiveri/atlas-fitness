import type { HabitKey } from '@/types/habit';

export interface HabitPreview {
  id: HabitKey;
  name: string;
  hint: string;
  icon: string;
}

export const HABIT_PREVIEWS: readonly HabitPreview[] = [
  {
    id: 'hydration',
    name: 'Hidratación',
    hint: 'Sumá tus litros de hoy',
    icon: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  },
  {
    id: 'walk',
    name: 'Pasos Activos',
    hint: 'Movimiento diario registrado por vos',
    icon: 'M13 4a1.5 1.5 0 1 0 0-.01 M11 8l-2 4 3 2v6 M9 12l-3 3 M13 14l3 1 1 5',
  },
  {
    id: 'mobility',
    name: 'Movilidad',
    hint: 'Cadera y tren superior',
    icon: 'M12 4a1.5 1.5 0 1 0 0-.01 M8 9h8 M12 9v5 M9 20l3-6 3 6',
  },
  {
    id: 'sleep',
    name: 'Descanso & Sueño',
    hint: 'Registrado manualmente',
    icon: 'M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z',
  },
] as const;

export function countCompletedHabits(doneByKey: Readonly<Record<HabitKey, boolean>>): number {
  return HABIT_PREVIEWS.filter((habit) => doneByKey[habit.id]).length;
}
