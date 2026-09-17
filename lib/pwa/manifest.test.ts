import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atlasWebManifest } from './manifest';
import { PWA_THEME } from './theme';

function pngSize(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function assertPng(fileName: string, size: number): void {
  const buf = readFileSync(join(process.cwd(), 'public', fileName));
  expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
    true
  );
  expect(pngSize(buf)).toEqual({ width: size, height: size });
}

describe('atlasWebManifest', () => {
  it('has the installability fields required for a standalone PWA', () => {
    expect(atlasWebManifest.name).toBe('Atlas Fitness');
    expect(atlasWebManifest.short_name).toBe('Atlas');
    expect(atlasWebManifest.start_url).toBe('/');
    expect(atlasWebManifest.display).toBe('standalone');
    expect(atlasWebManifest.theme_color).toBe(PWA_THEME.themeColor);
    expect(atlasWebManifest.background_color).toBe(PWA_THEME.backgroundColor);
  });

  it('lists 192 and 512 PNG icons with separate any and maskable purposes', () => {
    const icons = atlasWebManifest.icons ?? [];
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icon-192-maskable.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        }),
        expect.objectContaining({
          src: '/icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }),
      ])
    );
  });
});

describe('real PWA PNG icons', () => {
  it('ships 192x192 and 512x512 any + maskable icons (not placeholders)', () => {
    assertPng('icon-192.png', 192);
    assertPng('icon-512.png', 512);
    assertPng('icon-192-maskable.png', 192);
    assertPng('icon-512-maskable.png', 512);
    assertPng('apple-touch-icon.png', 180);
  });
});
