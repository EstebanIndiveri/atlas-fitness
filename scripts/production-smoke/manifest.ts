import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import type { ManifestStore, SmokeManifest } from './types';

/**
 * Parses and validates a secret-free manifest. Unknown/malformed shapes are
 * rejected (`null`) so a corrupt manifest is never trusted.
 */
export function parseManifest(value: unknown): SmokeManifest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const qaRunId = record.qaRunId;
  const expectedUserId = record.expectedUserId;
  const createdAt = record.createdAt;
  if (typeof qaRunId !== 'string' || qaRunId === '') {
    return null;
  }
  if (typeof expectedUserId !== 'number' || !Number.isInteger(expectedUserId) || expectedUserId <= 0) {
    return null;
  }
  if (typeof createdAt !== 'string' || createdAt === '') {
    return null;
  }
  return {
    qaRunId,
    expectedUserId,
    routineId: asNullablePositiveInt(record.routineId),
    exerciseId: asNullablePositiveInt(record.exerciseId),
    aId: asNullablePositiveInt(record.aId),
    bId: asNullablePositiveInt(record.bId),
    createdAt,
    workflowRunId: typeof record.workflowRunId === 'string' ? record.workflowRunId : null,
  };
}

function asNullablePositiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/** Serializes a manifest without pretty-print noise (still human-readable). */
export function serializeManifest(manifest: SmokeManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Filesystem-backed manifest store (secret-free; safe to persist). */
export function createFileManifestStore(path: string): ManifestStore {
  return {
    read: async () => {
      if (!existsSync(path)) {
        return null;
      }
      try {
        return parseManifest(JSON.parse(readFileSync(path, 'utf8')) as unknown);
      } catch {
        return null;
      }
    },
    write: async (manifest) => {
      writeFileSync(path, serializeManifest(manifest), { encoding: 'utf8' });
    },
    remove: async () => {
      rmSync(path, { force: true });
    },
  };
}
