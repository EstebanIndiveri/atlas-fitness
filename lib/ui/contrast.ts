import { hexToRgb } from './tokens';

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrastAa(
  foregroundHex: string,
  backgroundHex: string,
  largeText = false,
): boolean {
  const minimum = largeText ? 3 : 4.5;
  return contrastRatio(foregroundHex, backgroundHex) >= minimum;
}
