'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IosInstallHint } from '@/components/pwa/IosInstallHint';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useLinkCode } from '@/hooks/useLinkCode';
import { ROUTINE_COPY } from '@/lib/copy/routines';
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
    <div className="mx-auto w-full max-w-lg px-4 py-4 sm:px-6 sm:py-6">
      <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
        {TELEGRAM_FE_COPY.settingsBack}
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">{TELEGRAM_FE_COPY.settingsTitle}</h1>

      <section className="mt-6 space-y-3" data-testid="pwa-install-settings">
        <h2 className="text-lg font-semibold text-ink">{PWA_COPY.settingsInstallHeading}</h2>
        <IosInstallHint forceVisible />
      </section>

      <Card className="mt-6" data-testid="routines-settings">
        <h2 className="text-lg font-semibold text-ink">{ROUTINE_COPY.listTitle}</h2>
        <p className="mt-2 text-sm text-ink-muted">{ROUTINE_COPY.listSubtitle}</p>
        <Link
          href="/dashboard/routines"
          className={buttonClassName({ className: 'mt-4' })}
        >
          {ROUTINE_COPY.manageCta}
        </Link>
      </Card>

      <Card className="mt-6" data-testid="telegram-settings">
        <h2 className="text-lg font-semibold text-ink">Telegram</h2>
        {linked ? (
          <p className="mt-2 text-sm text-ink" data-testid="telegram-linked-status">
            {TELEGRAM_FE_COPY.linked}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink" data-testid="telegram-unlinked-status">
            {TELEGRAM_FE_COPY.unlinked}
          </p>
        )}

        <Button
          type="button"
          onClick={() => void requestCode()}
          disabled={loading}
          className="mt-4"
          data-testid="generate-link-code"
        >
          {loading ? TELEGRAM_FE_COPY.generating : TELEGRAM_FE_COPY.generateCode}
        </Button>

        {error && (
          <p className="mt-3 text-sm text-danger" data-testid="link-code-error">
            {error}
          </p>
        )}

        {code && (
          <div className="mt-4 rounded-md border border-line bg-canvas p-4">
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
              Vence: {new Date(code.expiresAt).toLocaleString('es-AR')}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
