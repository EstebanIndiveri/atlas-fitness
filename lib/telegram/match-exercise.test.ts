import { describe, it, expect } from '@jest/globals';
import { matchExercise, normalizeSearch } from './match-exercise';

const CATALOG = [
  { name: 'Press Banca', slug: 'bench-press' },
  { name: 'Press Militar', slug: 'overhead-press' },
  { name: 'Sentadilla', slug: 'squat' },
  { name: 'Peso Muerto', slug: 'deadlift' },
];

describe('matchExercise', () => {
  it('matches ignoring case and accents', () => {
    expect(normalizeSearch('Peso Muerto')).toBe('peso muerto');
    const result = matchExercise('PESO MUERTO', CATALOG);
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.exercise.slug).toBe('deadlift');
    }
  });

  it('matches a unique partial name', () => {
    const result = matchExercise('banca', CATALOG);
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.exercise.slug).toBe('bench-press');
    }
  });

  it('returns ambiguous when several exercises match', () => {
    const result = matchExercise('press', CATALOG);
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.exercises).toHaveLength(2);
    }
  });

  it('returns none for unknown names', () => {
    expect(matchExercise('yoga', CATALOG).status).toBe('none');
  });
});
