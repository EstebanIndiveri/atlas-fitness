import { createClient } from '@libsql/client';

import { loadLocalEnv, LOCAL_FILE_DB_URL } from '../dev/load-local-env';
import { REQUIRED_SCHEMA, REQUIRED_TABLES } from './readiness-contract';

interface ExistingIndex {
  unique: boolean;
  partial: boolean;
}

export interface DatabaseReadiness {
  ready: boolean;
  missingTables: string[];
  missingColumns: string[];
  missingPrimaryKeys: string[];
  missingIndexes: string[];
}

type DatabaseClient = ReturnType<typeof createClient>;
type RequiredTable = (typeof REQUIRED_SCHEMA)[number];

function getConfiguredDatabaseUrl(): string {
  return process.env.TURSO_DATABASE_URL || LOCAL_FILE_DB_URL;
}

function getRowValue(row: unknown, key: string): unknown {
  return typeof row === 'object' && row !== null ? Reflect.get(row, key) : undefined;
}

function extractNames(rows: unknown[]): string[] {
  return rows.flatMap((row) => {
    const name = getRowValue(row, 'name');
    return typeof name === 'string' ? [name] : [];
  });
}

function extractIndexes(rows: unknown[]): Map<string, ExistingIndex> {
  const indexes = new Map<string, ExistingIndex>();

  for (const row of rows) {
    const name = getRowValue(row, 'name');
    if (typeof name !== 'string') {
      continue;
    }

    indexes.set(name, {
      unique: getRowValue(row, 'unique') === 1,
      partial: getRowValue(row, 'partial') === 1,
    });
  }

  return indexes;
}

function extractPrimaryKeyColumns(rows: readonly unknown[]): string[] {
  return rows
    .flatMap((row) => {
      const name = getRowValue(row, 'name');
      const ordinal = getRowValue(row, 'pk');
      return typeof name === 'string' && typeof ordinal === 'number' && ordinal > 0
        ? [{ name, ordinal }]
        : [];
    })
    .sort((left, right) => left.ordinal - right.ordinal)
    .map(({ name }) => name);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function matchesColumns(actual: readonly string[], required: readonly string[]): boolean {
  return (
    actual.length === required.length &&
    required.every((column, index) => actual[index] === column)
  );
}

function normalizePredicate(predicate: string): string {
  return predicate
    .replace(/`([a-z_][a-z0-9_]*)`/gi, '$1')
    .replace(/"([a-z_][a-z0-9_]*)"/gi, '$1')
    .replace(/\[([a-z_][a-z0-9_]*)\]/gi, '$1')
    .trim()
    .replace(/;$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function matchesPredicate(indexSql: unknown, requiredPredicate: string): boolean {
  if (typeof indexSql !== 'string') {
    return false;
  }

  const predicate = /\bwhere\b([\s\S]+)$/i.exec(indexSql)?.[1];
  return (
    typeof predicate === 'string' &&
    normalizePredicate(predicate) === normalizePredicate(requiredPredicate)
  );
}

/**
 * Reports a table primary key when its PRAGMA metadata does not match the required column order.
 *
 * @param tableName - Table name used in the diagnostic.
 * @param requiredColumns - Required primary-key columns in declaration order.
 * @param tableInfoRows - Rows returned by `PRAGMA table_info`.
 * @returns An empty array for a match, otherwise the required primary-key diagnostic.
 * @example
 * findMissingPrimaryKey('user_streaks', ['user_id'], [{ name: 'user_id', pk: 1 }]);
 */
export function findMissingPrimaryKey(
  tableName: string,
  requiredColumns: readonly string[],
  tableInfoRows: readonly unknown[],
): string[] {
  return matchesColumns(extractPrimaryKeyColumns(tableInfoRows), requiredColumns)
    ? []
    : [`${tableName}(${requiredColumns.join(', ')})`];
}

async function inspectTable(
  client: DatabaseClient,
  contract: RequiredTable,
): Promise<
  Pick<DatabaseReadiness, 'missingColumns' | 'missingPrimaryKeys' | 'missingIndexes'>
> {
  const [tableInfo, indexList] = await Promise.all([
    client.execute(`PRAGMA table_info(${quoteIdentifier(contract.name)})`),
    client.execute(`PRAGMA index_list(${quoteIdentifier(contract.name)})`),
  ]);
  const existingColumns = new Set(extractNames(tableInfo.rows));
  const existingIndexes = extractIndexes(indexList.rows);
  const missingColumns = contract.columns
    .filter((column) => !existingColumns.has(column))
    .map((column) => `${contract.name}.${column}`);
  const missingPrimaryKeys = findMissingPrimaryKey(
    contract.name,
    contract.primaryKey,
    tableInfo.rows,
  );

  const missingIndexes = (
    await Promise.all(
      contract.indexes.map(async (requiredIndex): Promise<string | null> => {
        const existingIndex = existingIndexes.get(requiredIndex.name);
        if (
          !existingIndex?.unique ||
          existingIndex.partial !== (requiredIndex.partial ?? false)
        ) {
          return requiredIndex.name;
        }

        const indexInfo = await client.execute(
          `PRAGMA index_info(${quoteIdentifier(requiredIndex.name)})`,
        );
        if (!matchesColumns(extractNames(indexInfo.rows), requiredIndex.columns)) {
          return requiredIndex.name;
        }

        if (requiredIndex.predicate === undefined) {
          return null;
        }

        const indexDefinition = await client.execute({
          sql: "select sql from sqlite_master where type = 'index' and name = ?",
          args: [requiredIndex.name],
        });
        const indexSql = getRowValue(indexDefinition.rows.at(0), 'sql');
        return matchesPredicate(indexSql, requiredIndex.predicate) ? null : requiredIndex.name;
      }),
    )
  ).filter((name): name is string => name !== null);

  return { missingColumns, missingPrimaryKeys, missingIndexes };
}

/**
 * Returns the required tables that are not present in the provided set.
 *
 * @param existingTables - Tables already present in the database.
 * @returns Missing required table names in declaration order.
 */
export function findMissingTables(existingTables: Iterable<string>): string[] {
  const existing = new Set(existingTables);
  return REQUIRED_TABLES.filter((table) => !existing.has(table));
}

/**
 * Inspects the configured database and reports whether the application schema is ready.
 *
 * @returns A readiness summary with missing required tables, columns, primary keys, and indexes.
 * @throws If the database cannot be reached or a schema query fails.
 * @example
 * await inspectConfiguredDatabase();
 */
export async function inspectConfiguredDatabase(): Promise<DatabaseReadiness> {
  loadLocalEnv();

  const client = createClient({
    url: getConfiguredDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  try {
    const result = await client.execute(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
    );
    const existingTables = new Set(extractNames(result.rows));
    const missingTables = findMissingTables(existingTables);
    const tableResults = await Promise.all(
      REQUIRED_SCHEMA.filter(({ name }) => existingTables.has(name)).map((contract) =>
        inspectTable(client, contract),
      ),
    );
    const missingColumns = tableResults.flatMap((table) => table.missingColumns);
    const missingPrimaryKeys = tableResults.flatMap((table) => table.missingPrimaryKeys);
    const missingIndexes = tableResults.flatMap((table) => table.missingIndexes);

    return {
      ready:
        missingTables.length === 0 &&
        missingColumns.length === 0 &&
        missingPrimaryKeys.length === 0 &&
        missingIndexes.length === 0,
      missingTables,
      missingColumns,
      missingPrimaryKeys,
      missingIndexes,
    };
  } finally {
    client.close();
  }
}

export { REQUIRED_TABLES };
