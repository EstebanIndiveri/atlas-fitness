import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { PWA_THEME } from '@/lib/pwa/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Atlas Fitness',
  description: 'Asistente de fitness personal para registrar entrenamientos',
  manifest: '/manifest.webmanifest',
  applicationName: 'Atlas Fitness',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Atlas',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: PWA_THEME.themeColor,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
