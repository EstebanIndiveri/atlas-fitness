import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { IosInstallHint } from '@/components/pwa/IosInstallHint';
import { InstallBanner } from '@/components/pwa/InstallBanner';
import { buttonClassName } from '@/components/ui/Button';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { PWA_COPY } from '@/lib/pwa/copy';

export default function HomePage() {
  return (
    <AppShell variant="public">
      <div className="flex flex-col items-center justify-center px-4 py-section sm:px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="mb-4 text-display font-bold text-ink">{UI_COPY.brand}</h1>
          <p className="text-lg text-ink-muted">Asistente de fitness personal — registrar entrenos y hábitos</p>
          <p className="mt-4 text-sm text-ink-muted">
            PWA instalable. Iniciá sesión para entrenar, o agregá Atlas a tu pantalla de inicio.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              data-testid={UI_COPY_TEST_IDS.homeLoginCta}
              className={buttonClassName({ variant: 'primary' })}
            >
              {UI_COPY.navLogin}
            </Link>
            <Link href="/register" className={buttonClassName({ variant: 'secondary' })}>
              {UI_COPY.navRegister}
            </Link>
          </div>
          <div className="mt-8 space-y-4 text-left">
            <InstallBanner />
            <h2 className="text-sm font-semibold text-ink">{PWA_COPY.settingsInstallHeading}</h2>
            <IosInstallHint forceVisible />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
