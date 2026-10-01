import { describe, expect, it } from '@jest/globals';
import {
  FOCUS_RING_CLASS,
  RADIUS_ROLE_CLASS,
  SURFACE_ROLE_CLASS,
  TYPE_ROLE_CLASS,
} from './roles';

describe('surface roles (brief §12)', () => {
  it('resolves the three depth levels predictably', () => {
    expect(SURFACE_ROLE_CLASS.canvas).toBe('bg-canvas');

    expect(SURFACE_ROLE_CLASS.panel).toContain('rounded-panel');
    expect(SURFACE_ROLE_CLASS.panel).toContain('bg-surface');
    expect(SURFACE_ROLE_CLASS.panel).not.toContain('shadow');

    expect(SURFACE_ROLE_CLASS.overlay).toContain('rounded-hero');
    expect(SURFACE_ROLE_CLASS.overlay).toContain('bg-overlay');
    expect(SURFACE_ROLE_CLASS.overlay).toContain('shadow-overlay');
  });
});

describe('radius roles (brief §12)', () => {
  it('maps to named radius utilities and keeps pill for pills only', () => {
    expect(RADIUS_ROLE_CLASS.control).toBe('rounded-control');
    expect(RADIUS_ROLE_CLASS.panel).toBe('rounded-panel');
    expect(RADIUS_ROLE_CLASS.hero).toBe('rounded-hero');
    expect(RADIUS_ROLE_CLASS.pill).toBe('rounded-pill');
  });
});

describe('type roles (brief §9)', () => {
  it('gives the numeric data role truthful tabular alignment', () => {
    expect(TYPE_ROLE_CLASS.numeric).toContain('text-numeric');
    expect(TYPE_ROLE_CLASS.numeric).toContain('numeric');
  });

  it('keeps editorial display on the serif role and body on sans', () => {
    expect(TYPE_ROLE_CLASS.display).toContain('font-display');
    expect(TYPE_ROLE_CLASS.body).toBe('text-body');
  });
});

describe('focus ring', () => {
  it('uses a visible outline shape without encoding state in color', () => {
    expect(FOCUS_RING_CLASS).toContain('focus-visible:outline');
    expect(FOCUS_RING_CLASS).toContain('focus-visible:outline-2');
    expect(FOCUS_RING_CLASS).toContain('focus-visible:outline-offset-2');
  });
});
