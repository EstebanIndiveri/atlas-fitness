import { expect, type Locator } from '@playwright/test';
import { cssColorsMatch } from '../lib/styles/css-color';
import { ATLAS_COLOR_RGB, ATLAS_RADIUS_PX } from '../lib/ui/tokens';

/** HU-B token smoke — compare computed colors in RGB channel space (rgb or lab). */
export const ATLAS_SMOKE = {
  brand: ATLAS_COLOR_RGB.brand,
  canvas: ATLAS_COLOR_RGB.canvas,
  ink: ATLAS_COLOR_RGB.ink,
  brandForeground: ATLAS_COLOR_RGB.brandForeground,
  roundedMd: ATLAS_RADIUS_PX.md,
} as const;

/**
 * Chromium in GitHub Actions serializes computed colors as lab();
 * compare in RGB channel space so rgb() and lab() equivalents pass.
 */
export async function expectCssColor(
  locator: Locator,
  property: 'background-color' | 'color',
  expectedRgb: string,
): Promise<void> {
  const actual = await locator.evaluate((element, cssProperty) => {
    return getComputedStyle(element).getPropertyValue(cssProperty);
  }, property);

  expect(
    cssColorsMatch(actual, expectedRgb),
    `expected ${property} to match ${expectedRgb} (rgb or lab), received ${actual}`,
  ).toBe(true);
}
