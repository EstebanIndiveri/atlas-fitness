/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { buildMarker, buildSyntheticNote, hasSmokePrefix, parseMarker } from './marker';

describe('marker', () => {
  it('builds and parses a history marker', () => {
    const marker = buildMarker('abc123', 'history');
    expect(marker).toBe('ATLAS_SMOKE:abc123:history');
    expect(parseMarker(marker)).toEqual({ qaRunId: 'abc123', role: 'history' });
  });

  it('builds and parses a current marker', () => {
    expect(parseMarker(buildMarker('run-9', 'current'))).toEqual({
      qaRunId: 'run-9',
      role: 'current',
    });
  });

  it('returns null for non-marker notes', () => {
    expect(parseMarker(null)).toBeNull();
    expect(parseMarker('just a note')).toBeNull();
    expect(parseMarker('ATLAS_SMOKE')).toBeNull();
  });

  it('rejects a prefix without a valid role', () => {
    expect(hasSmokePrefix('ATLAS_SMOKE:abc:other')).toBe(true);
    expect(parseMarker('ATLAS_SMOKE:abc:other')).toBeNull();
    expect(parseMarker('ATLAS_SMOKE:abc')).toBeNull();
    expect(parseMarker('ATLAS_SMOKE::history')).toBeNull();
  });

  it('builds a synthetic note distinct from the marker', () => {
    expect(buildSyntheticNote('abc123')).toBe('ATLAS_SMOKE_NOTE:abc123');
  });
});
