import { describe, expect, it } from '@jest/globals';
import { motivatorForSet, formatImprovement, SESSION_COPY } from './session';

describe('SESSION_COPY', () => {
  it('uses es-AR product copy for the guided flow', () => {
    expect(SESSION_COPY.pickTitle).toBe('Elegí una rutina');
    expect(SESSION_COPY.completeSet).toBe('Completar serie');
    expect(SESSION_COPY.skipExercise).toBe('Saltar');
    expect(SESSION_COPY.holdExercise).toBe('Posponer');
    expect(SESSION_COPY.errorNotActive).toMatch(/no está activa/);
    expect(SESSION_COPY.noImage).toBe('Sin imagen');
    expect(SESSION_COPY.closeTitle).toMatch(/Sesión completada/);
    expect(SESSION_COPY.streakDays(1)).toBe('1 día seguido');
    expect(SESSION_COPY.streakDays(3)).toBe('3 días seguidos');
  });
});

describe('motivatorForSet', () => {
  it('returns a stable phrase from the pool', () => {
    expect(motivatorForSet(1)).toBe(SESSION_COPY.motivators[0]);
    expect(motivatorForSet(SESSION_COPY.motivators.length + 1)).toBe(SESSION_COPY.motivators[0]);
  });
});

describe('formatImprovement', () => {
  it('renders es-AR deltas from decimal strings', () => {
    expect(
      formatImprovement({ exerciseName: 'Press Banca', direction: 'up', deltaKg: '2.5' }),
    ).toBe('Press Banca: +2.5 kg vs la última sesión.');
    expect(
      formatImprovement({ exerciseName: 'Sentadilla', direction: 'none', deltaKg: null }),
    ).toBe(SESSION_COPY.improvementNone);
  });
});
