import type { UserPreferences } from '@/types/user-preferences';

const PREFERENCE_LABELS: Record<keyof UserPreferences, string> = {
  goal: 'Objetivo personal',
  pace: 'Ritmo',
  equipment: 'Equipo disponible',
};

export function profilePreferenceLabel(field: keyof UserPreferences): string {
  return PREFERENCE_LABELS[field];
}
