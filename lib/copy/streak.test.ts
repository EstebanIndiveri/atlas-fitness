import { describe, expect, it } from '@jest/globals';
import { STREAK_COPY } from './streak';

describe('STREAK_COPY', () => {
  it('is es-AR copy for streak delight and zero state', () => {
    expect(STREAK_COPY.regionLabel).toBe('Racha de hábito');
    expect(STREAK_COPY.currentLabel).toBe('Racha actual');
    expect(STREAK_COPY.longestLabel).toBe('Mejor racha');
    expect(STREAK_COPY.zeroTitle).toBe('Todavía no tenés racha');
    expect(STREAK_COPY.zeroBody).toMatch(/Entrená o registrá tu ánimo hoy/);
    expect(STREAK_COPY.retry).toBe('Reintentar');
    expect(STREAK_COPY.recordBadge).toBe('Récord');
  });
});
