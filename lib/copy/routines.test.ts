import { describe, expect, it } from '@jest/globals';
import { ROUTINE_COPY } from './routines';

describe('ROUTINE_COPY', () => {
  it('uses es-AR copy for the editor', () => {
    expect(ROUTINE_COPY.listTitle).toBe('Rutinas');
    expect(ROUTINE_COPY.createCta).toBe('Nueva rutina');
    expect(ROUTINE_COPY.notFound).toBe('Rutina no encontrada');
    expect(ROUTINE_COPY.mediaEmpty).toBe('Sin imagen');
    expect(ROUTINE_COPY.mediaUrlHint).toMatch(/https:\/\//);
    expect(ROUTINE_COPY.mediaUrlHint).not.toMatch(/http\(s\)/);
    expect(ROUTINE_COPY.mediaUrlLengthHint).toMatch(/2048/);
  });
});
