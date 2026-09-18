import { describe, expect, it } from '@jest/globals';
import { isMissingDatabaseSchemaError } from './errors';

describe('isMissingDatabaseSchemaError', () => {
  it('returns true for wrapped missing-table errors', () => {
    const error = new Error('Drizzle query failed', {
      cause: new Error('SQLITE_UNKNOWN: SQLite error: no such table: users'),
    });

    expect(isMissingDatabaseSchemaError(error)).toBe(true);
  });

  it('returns true for direct missing-table errors', () => {
    expect(
      isMissingDatabaseSchemaError(
        new Error('SQLite error: no such table: workouts'),
      ),
    ).toBe(true);
  });

  it('returns false for unrelated errors and null', () => {
    expect(isMissingDatabaseSchemaError(new Error('connection timeout'))).toBe(
      false,
    );
    expect(isMissingDatabaseSchemaError(null)).toBe(false);
  });
});
