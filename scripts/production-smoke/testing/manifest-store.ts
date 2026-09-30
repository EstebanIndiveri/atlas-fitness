/**
 * Test-only in-memory manifest store. Never touches the filesystem.
 */
import type { ManifestStore, SmokeManifest } from '../types';

export interface MemoryManifestStore extends ManifestStore {
  current: () => SmokeManifest | null;
  writes: SmokeManifest[];
  removes: number;
}

export function createMemoryManifestStore(
  initial: SmokeManifest | null = null,
): MemoryManifestStore {
  let value = initial;
  const writes: SmokeManifest[] = [];
  let removes = 0;
  return {
    current: () => value,
    writes,
    get removes() {
      return removes;
    },
    read: async () => value,
    write: async (manifest) => {
      value = manifest;
      writes.push(manifest);
    },
    remove: async () => {
      value = null;
      removes += 1;
    },
  };
}
