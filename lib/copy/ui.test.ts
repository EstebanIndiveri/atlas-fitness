import { describe, expect, it } from '@jest/globals';
import { UI_COPY } from './ui';

describe('UI_COPY', () => {
  it('is es-AR product copy for shell and states', () => {
    expect(UI_COPY.brand).toBe('Atlas Fitness');
    expect(UI_COPY.skipToContent).toBe('Saltar al contenido');
    expect(UI_COPY.navLogin).toBe('Iniciar sesión');
    expect(UI_COPY.navSession).toBe('Sesión');
    expect(UI_COPY.logout).toBe('Cerrar sesión');
    expect(UI_COPY.loading).toMatch(/Cargando/);
  });
});
