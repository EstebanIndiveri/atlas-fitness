'use client';

import { useEffect, useState } from 'react';

import { IosInstallHint } from '@/components/pwa/IosInstallHint';
import { ProfileHeaderCard } from '@/components/profile/ProfileHeaderCard';
import { SettingsRow } from '@/components/profile/SettingsRow';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { LogoutButton } from '@/components/shell/AppNav';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useLinkCode } from '@/hooks/useLinkCode';
import { APP_VERSION } from '@/lib/app/version';
import { UI_COPY } from '@/lib/copy/ui';
import { PWA_COPY } from '@/lib/pwa/copy';
import { TELEGRAM_FE_COPY } from '@/lib/telegram/copy';
import type { AuthUser } from '@/types/auth';

export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { code, loading, error, requestCode } = useLinkCode();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          setLoadError(TELEGRAM_FE_COPY.loadError);
          return;
        }
        const data = (await response.json()) as AuthUser;
        setUser(data);
      } catch {
        setLoadError(TELEGRAM_FE_COPY.loadError);
      } finally {
        setLoadingUser(false);
      }
    };

    void load();
  }, []);

  if (loadingUser) {
    return <LoadingState label={TELEGRAM_FE_COPY.loading} />;
  }

  if (loadError || !user) {
    return (
      <div className="px-4 py-section">
        <ErrorState message={loadError ?? TELEGRAM_FE_COPY.loadError} />
      </div>
    );
  }

  const linked = Boolean(user.telegramUserId);

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 py-4 sm:px-6 sm:py-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
          {UI_COPY.profileTitle}
        </h1>
      </header>

      <ProfileHeaderCard user={user} />

      <SettingsSection title={UI_COPY.profileMiAtlasTitle}>
        <SettingsRow
          title={UI_COPY.profileRoutinesTitle}
          description={UI_COPY.profileRoutinesDescription}
          href="/dashboard/routines"
          testId="routines-settings"
        />
        <SettingsRow
          title={UI_COPY.profileHabitsTitle}
          description={UI_COPY.profileHabitsDescription}
          href="/dashboard/today"
        />
      </SettingsSection>

      <Card data-testid="telegram-settings" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {UI_COPY.profileIntegrationsTitle} — {UI_COPY.profileTelegramTitle}
          </h2>
          {linked ? (
            <p className="mt-2 text-sm text-ink" data-testid="telegram-linked-status">
              {TELEGRAM_FE_COPY.linked}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink" data-testid="telegram-unlinked-status">
              {TELEGRAM_FE_COPY.unlinked}
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={() => void requestCode()}
          disabled={loading}
          data-testid="generate-link-code"
        >
          {loading ? TELEGRAM_FE_COPY.generating : TELEGRAM_FE_COPY.generateCode}
        </Button>

        {error && (
          <p className="text-sm text-danger" data-testid="link-code-error">
            {error}
          </p>
        )}

        {code && (
          <div className="rounded-md border border-line bg-canvas p-4">
            <p className="text-xs uppercase tracking-wide text-ink-muted">
              {TELEGRAM_FE_COPY.codeLabel}
            </p>
            <p
              className="mt-1 font-mono text-2xl font-semibold tracking-widest text-ink"
              data-testid="telegram-link-code"
            >
              {code.code}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{TELEGRAM_FE_COPY.codeHint}</p>
            <p className="mt-1 text-xs text-ink-muted" data-testid="telegram-link-code-expiry">
              {UI_COPY.profileTelegramExpiryPrefix} {new Date(code.expiresAt).toLocaleString('es-AR')}
            </p>
          </div>
        )}
      </Card>

      <SettingsSection title={UI_COPY.profileApplicationTitle}>
        <div className="space-y-3 p-4" data-testid="pwa-install-settings">
          <h3 className="text-sm font-medium text-ink">{PWA_COPY.settingsInstallHeading}</h3>
          <IosInstallHint forceVisible />
        </div>
        <SettingsRow
          title={UI_COPY.profileUnitsTitle}
          description={UI_COPY.profileUnitsDescription}
        />
        <SettingsRow
          title={UI_COPY.profileAppearanceTitle}
          description={UI_COPY.profileAppearanceDescription}
        />
      </SettingsSection>

      <Card data-testid="account-settings">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{UI_COPY.profileAccountTitle}</h2>
            <p className="mt-2 text-sm text-ink-muted">{UI_COPY.profileLogoutDescription}</p>
            <p className="mt-2 text-xs text-ink-muted">{UI_COPY.profileVersionLabel(APP_VERSION)}</p>
          </div>
          <LogoutButton />
        </div>
      </Card>
    </div>
  );
}
