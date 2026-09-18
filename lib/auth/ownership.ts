import { eq, or } from 'drizzle-orm';
import { exercises, routines } from '@/lib/db/schema';
import { AppError } from '@/types/errors';

export interface CatalogOwnership {
  isSystem: boolean;
  userId: number | null;
}

export interface CatalogMutateMessages {
  notFoundMessage: string;
  forbiddenMessage: string;
}

type CatalogTable = typeof exercises | typeof routines;

/**
 * Catalog visibility: system rows are public; custom rows only for the owner.
 */
export function canAccessCatalogItem(
  item: CatalogOwnership,
  currentUserId: number,
): boolean {
  return item.isSystem || item.userId === currentUserId;
}

export function assertCanAccessCatalogItem(
  item: CatalogOwnership | null | undefined,
  currentUserId: number,
  notFoundMessage: string,
): asserts item is CatalogOwnership {
  if (!item || !canAccessCatalogItem(item, currentUserId)) {
    throw new AppError('NOT_FOUND', notFoundMessage);
  }
}

export function assertCanMutateCatalogItem(
  item: CatalogOwnership | null | undefined,
  currentUserId: number,
  messages: CatalogMutateMessages,
): asserts item is CatalogOwnership {
  assertCanAccessCatalogItem(item, currentUserId, messages.notFoundMessage);
  if (item.isSystem) {
    throw new AppError('FORBIDDEN', messages.forbiddenMessage);
  }
}

/**
 * SQL filter matching canAccessCatalogItem for list queries.
 */
export function catalogVisibleToUser(table: CatalogTable, currentUserId: number) {
  return or(eq(table.isSystem, true), eq(table.userId, currentUserId));
}
