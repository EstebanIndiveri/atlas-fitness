import { expect, type Locator } from '@playwright/test';
import { cssColorsMatch } from '../lib/styles/css-color';

/** Default Tailwind palette — smoke that utilities apply. Not a design-token system. */
export const TW_SMOKE = {
  slate900: 'rgb(15, 23, 42)',
  gray50: 'rgb(249, 250, 251)',
  white: 'rgb(255, 255, 255)',
  roundedMd: '6px',
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
