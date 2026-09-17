import Link from 'next/link';
import { IosInstallHint } from '@/components/pwa/IosInstallHint';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { PWA_COPY } from '@/lib/pwa/copy';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-4 text-4xl font-bold">Atlas Fitness</h1>
        <p className="text-lg text-gray-600">Asistente de fitness personal — registrar entrenos y hábitos</p>
        <p className="mt-4 text-sm text-gray-500">
          PWA instalable. Iniciá sesión para entrenar, o agregá Atlas a tu pantalla de inicio.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Crear cuenta
          </Link>
        </div>
        <div className="mt-8 space-y-4 text-left">
          <InstallBanner />
          <h2 className="text-sm font-semibold text-slate-800">{PWA_COPY.settingsInstallHeading}</h2>
          <IosInstallHint forceVisible />
        </div>
      </div>
    </main>
  );
}
