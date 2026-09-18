import { describe, expect, it } from '@jest/globals';
import { contrastRatio, meetsContrastAa } from './contrast';
import { ATLAS_COLOR } from './tokens';

describe('Atlas token contrast (WCAG AA)', () => {
  it('ink on canvas and surface meets AAA body text', () => {
    expect(contrastRatio(ATLAS_COLOR.ink, ATLAS_COLOR.canvas)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(ATLAS_COLOR.ink, ATLAS_COLOR.surface)).toBeGreaterThanOrEqual(7);
  });

  it('ink-muted on canvas meets AA', () => {
    expect(meetsContrastAa(ATLAS_COLOR.inkMuted, ATLAS_COLOR.canvas)).toBe(true);
  });

  it('primary and danger buttons meet AA for white label text', () => {
    expect(meetsContrastAa(ATLAS_COLOR.brandForeground, ATLAS_COLOR.brand)).toBe(true);
    expect(meetsContrastAa(ATLAS_COLOR.brandForeground, ATLAS_COLOR.brandHover)).toBe(true);
    expect(meetsContrastAa(ATLAS_COLOR.dangerForeground, ATLAS_COLOR.danger)).toBe(true);
    expect(meetsContrastAa(ATLAS_COLOR.warningForeground, ATLAS_COLOR.warning)).toBe(true);
  });

  it('banner and error surfaces keep readable ink/danger text', () => {
    expect(meetsContrastAa(ATLAS_COLOR.ink, ATLAS_COLOR.warningMuted)).toBe(true);
    expect(meetsContrastAa(ATLAS_COLOR.danger, ATLAS_COLOR.dangerMuted)).toBe(true);
    expect(meetsContrastAa(ATLAS_COLOR.ink, ATLAS_COLOR.brandMuted)).toBe(true);
  });
});
