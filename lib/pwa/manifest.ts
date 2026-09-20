import type { MetadataRoute } from 'next';
import { PWA_THEME } from '@/lib/pwa/theme';

export const atlasWebManifest: MetadataRoute.Manifest = {
  name: 'Atlas Fitness',
  short_name: 'Atlas',
  description: 'Asistente de fitness personal para registrar entrenamientos',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  lang: 'es-AR',
  theme_color: PWA_THEME.themeColor,
  background_color: PWA_THEME.backgroundColor,
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-192-maskable.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icon-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};
