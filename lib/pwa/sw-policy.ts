/**
 * Keep this list in sync with `public/sw.js` PRECACHE_URLS.
 * The service worker precaches the public shell + icons only.
 * It must never cache `/api/*` (session cookies / workouts stay on the network).
 */
export const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
] as const;

export function shouldBypassServiceWorker(pathname: string, method: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return true;
  }
  return pathname.startsWith('/api/');
}

export function isStaticBuildAsset(pathname: string): boolean {
  return pathname.startsWith('/_next/static/');
}
