import { describe, expect, it } from '@jest/globals';
import {
  assertCanAccessCatalogItem,
  assertCanMutateCatalogItem,
  canAccessCatalogItem,
} from './ownership';
import { AppError } from '@/types/errors';

const MUTATE_MESSAGES = {
  notFoundMessage: 'Ejercicio no encontrado',
  forbiddenMessage: 'No puedes modificar un ejercicio del sistema',
} as const;

describe('canAccessCatalogItem', () => {
  it('allows system catalog items for any user', () => {
    expect(canAccessCatalogItem({ isSystem: true, userId: null }, 1)).toBe(true);
    expect(canAccessCatalogItem({ isSystem: true, userId: 99 }, 1)).toBe(true);
  });

  it('allows a custom item owned by the current user', () => {
    expect(canAccessCatalogItem({ isSystem: false, userId: 7 }, 7)).toBe(true);
  });

  it('denies another user custom item', () => {
    expect(canAccessCatalogItem({ isSystem: false, userId: 7 }, 3)).toBe(false);
  });

  it('denies a custom item without owner', () => {
    expect(canAccessCatalogItem({ isSystem: false, userId: null }, 1)).toBe(false);
  });
});

describe('assertCanAccessCatalogItem', () => {
  it('does not throw for system or owned items', () => {
    expect(() =>
      assertCanAccessCatalogItem({ isSystem: true, userId: null }, 1, 'no encontrado'),
    ).not.toThrow();
    expect(() =>
      assertCanAccessCatalogItem({ isSystem: false, userId: 4 }, 4, 'no encontrado'),
    ).not.toThrow();
  });

  it('throws NOT_FOUND for missing and foreign items (404 ajeno)', () => {
    expect(() => assertCanAccessCatalogItem(null, 1, 'Ejercicio no encontrado')).toThrow(
      AppError,
    );

    try {
      assertCanAccessCatalogItem({ isSystem: false, userId: 9 }, 1, 'Ejercicio no encontrado');
      throw new Error('expected AppError');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Ejercicio no encontrado',
      });
    }
  });
});

describe('assertCanMutateCatalogItem', () => {
  it('allows mutating own custom items', () => {
    expect(() =>
      assertCanMutateCatalogItem({ isSystem: false, userId: 2 }, 2, MUTATE_MESSAGES),
    ).not.toThrow();
  });

  it('throws NOT_FOUND for foreign custom items', () => {
    try {
      assertCanMutateCatalogItem({ isSystem: false, userId: 9 }, 1, MUTATE_MESSAGES);
      throw new Error('expected AppError');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Ejercicio no encontrado',
      });
    }
  });

  it('throws FORBIDDEN when mutating a system item', () => {
    try {
      assertCanMutateCatalogItem({ isSystem: true, userId: null }, 1, MUTATE_MESSAGES);
      throw new Error('expected AppError');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'No puedes modificar un ejercicio del sistema',
      });
    }
  });
});
