import { describe, expect, it } from '@jest/globals';
import {
  ATLAS_ICON_COUNT,
  ATLAS_ICON_NAMES,
  ATLAS_ICON_PATHS,
  ATLAS_ICON_SIZES,
  ATLAS_ICON_STROKE_WIDTH,
  ATLAS_ICON_VIEW_BOX,
} from './atlas-icons';

const REQUIRED_NAMES = [
  'today',
  'session',
  'progress',
  'profile',
  'technique',
  'replace',
  'notes',
  'history',
  'rest',
  'verified',
  'complete',
  'tie',
  'unknown',
  'warning',
  'error',
  'chevron',
] as const;

describe('governed Atlas icon catalog (brief §13–15)', () => {
  it('shares one optical grid: 24 viewBox and a stroke in the 1.8–2px range', () => {
    expect(ATLAS_ICON_VIEW_BOX).toBe('0 0 24 24');
    expect(ATLAS_ICON_STROKE_WIDTH).toBeGreaterThanOrEqual(1.8);
    expect(ATLAS_ICON_STROKE_WIDTH).toBeLessThanOrEqual(2);
    expect(ATLAS_ICON_SIZES).toEqual({ sm: 16, md: 20, lg: 24 });
  });

  it('exposes focused sizes suitable for 16/20/24 rendering', () => {
    expect(Object.values(ATLAS_ICON_SIZES)).toEqual([16, 20, 24]);
  });

  it('gives every governed name at least one non-empty path', () => {
    for (const name of ATLAS_ICON_NAMES) {
      const paths = ATLAS_ICON_PATHS[name];
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('covers the high-value navigation, session and state semantics', () => {
    for (const name of REQUIRED_NAMES) {
      expect(ATLAS_ICON_NAMES).toContain(name);
    }
  });

  it('keeps completion, verified and tie as distinct signs', () => {
    expect(ATLAS_ICON_PATHS.complete).not.toEqual(ATLAS_ICON_PATHS.verified);
    expect(ATLAS_ICON_PATHS.tie).not.toEqual(ATLAS_ICON_PATHS.complete);
    expect(ATLAS_ICON_PATHS.unknown).not.toEqual(ATLAS_ICON_PATHS.error);
  });

  it('reports the governed catalog size from the single source', () => {
    expect(ATLAS_ICON_COUNT).toBe(ATLAS_ICON_NAMES.length);
  });
});
