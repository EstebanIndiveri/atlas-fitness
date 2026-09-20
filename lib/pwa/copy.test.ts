import { describe, expect, it } from '@jest/globals';
import { PWA_COPY } from './copy';

describe('PWA_COPY', () => {
  it('includes iOS Agregar a Inicio / Home Screen copy in es-AR', () => {
    expect(PWA_COPY.iosTitle).toBe('Agregar a Inicio');
    expect(PWA_COPY.iosBody).toMatch(/Home Screen/);
    expect(PWA_COPY.iosStepAdd).toMatch(/Agregar a Inicio/);
    expect(PWA_COPY.installCta).toBe('Instalar');
  });
});
