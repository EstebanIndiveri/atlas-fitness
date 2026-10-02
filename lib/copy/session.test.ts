import { describe, expect, it } from '@jest/globals';
import { motivatorForSet, SESSION_COPY } from './session';

describe('SESSION_COPY', () => {
  it('uses es-AR product copy for the guided flow', () => {
    expect(SESSION_COPY.completeSet).toBe('Completar serie');
    expect(SESSION_COPY.skipExercise).toBe('Saltar');
    expect(SESSION_COPY.holdExercise).toBe('Posponer');
    expect(SESSION_COPY.errorNotActive).toMatch(/no está activa/);
    expect(SESSION_COPY.noImage).toBe('Sin imagen');
    // Pre-close copy states routine completion, never an unperformed persistence.
    expect(SESSION_COPY.closeTitle).toMatch(/Rutina completada/);
    expect(SESSION_COPY.closeTitle).not.toMatch(/guardad|Sesión completada/i);
    expect(SESSION_COPY.closeSavedTitle).toMatch(/Sesión guardada/);
    expect(SESSION_COPY.streakDays(1)).toBe('1 día seguido');
    expect(SESSION_COPY.streakDays(3)).toBe('3 días seguidos');
  });

  it('states feedback persistence without promising recovery or next-load changes', () => {
    expect(SESSION_COPY.feedbackHelper).toBe(
      'Guardamos este feedback como parte de esta sesión. No cambia tu plan ni recomienda cargas automáticamente.',
    );
    expect(SESSION_COPY.feedbackHelper).not.toMatch(/recuperaci|próximas cargas|calibrar/i);
  });
});

describe('motivatorForSet', () => {
  it('returns a stable phrase from the pool', () => {
    expect(motivatorForSet(1)).toBe(SESSION_COPY.motivators[0]);
    expect(motivatorForSet(SESSION_COPY.motivators.length + 1)).toBe(SESSION_COPY.motivators[0]);
  });
});

describe('SESSION_COPY close summary', () => {
  it('no longer exposes bare-weight improvement or volume copy', () => {
    const copy = SESSION_COPY as unknown as Record<string, unknown>;
    expect(copy.improvementUp).toBeUndefined();
    expect(copy.improvementDown).toBeUndefined();
    expect(copy.improvementSame).toBeUndefined();
    expect(copy.improvementNone).toBeUndefined();
    expect(copy.closeStatsVolume).toBeUndefined();
  });
});
