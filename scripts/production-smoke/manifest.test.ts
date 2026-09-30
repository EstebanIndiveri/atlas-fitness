/**
 * @jest-environment node
 */
import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFileManifestStore, parseManifest, serializeManifest } from './manifest';

const VALID = {
  qaRunId: 'a'.repeat(32),
  expectedUserId: 7,
  routineId: 3,
  exerciseId: 4,
  aId: 100,
  bId: 101,
  createdAt: '2026-09-30T00:00:00.000Z',
  workflowRunId: 'run-9',
};

describe('parseManifest', () => {
  it('accepts a valid secret-free manifest', () => {
    expect(parseManifest(VALID)).toEqual(VALID);
  });

  it('rejects malformed shapes and missing ids', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest('nope')).toBeNull();
    expect(parseManifest({ ...VALID, expectedUserId: 0 })).toBeNull();
    expect(parseManifest({ ...VALID, qaRunId: '' })).toBeNull();
    expect(parseManifest({ ...VALID, createdAt: '' })).toBeNull();
  });

  it('normalizes absent optional ids to null', () => {
    const parsed = parseManifest({ ...VALID, aId: undefined, bId: 'x' });
    expect(parsed).toMatchObject({ aId: null, bId: null });
  });

  it('never serializes a secret-like value (ids only)', () => {
    const serialized = serializeManifest(VALID);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('set-cookie');
  });
});

describe('createFileManifestStore', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('round-trips a manifest and removes it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-manifest-'));
    dirs.push(dir);
    const path = join(dir, 'manifest.json');
    const store = createFileManifestStore(path);

    expect(await store.read()).toBeNull();
    await store.write(VALID);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(VALID);
    expect(await store.read()).toEqual(VALID);
    await store.remove();
    expect(await store.read()).toBeNull();
  });

  it('rejects a corrupt manifest file instead of trusting it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-manifest-'));
    dirs.push(dir);
    const path = join(dir, 'manifest.json');
    const store = createFileManifestStore(path);
    await store.write(VALID);
    writeFileSync(path, 'not-json', 'utf8');
    expect(await store.read()).toBeNull();
  });
});
