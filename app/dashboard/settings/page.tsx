'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TELEGRAM_FE_COPY } from '@/lib/telegram/copy';
import { useLinkCode } from '@/hooks/useLinkCode';
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
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>{TELEGRAM_FE_COPY.loading}</p>
      </main>
    );
  }

  if (loadError || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-red-700">{loadError ?? TELEGRAM_FE_COPY.loadError}</p>
      </main>
    );
  }

  const linked = Boolean(user.telegramUserId);

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-lg">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
          {TELEGRAM_FE_COPY.settingsBack}
        </Link>
        <h1 className="mt-4 text-2xl font-bold">{TELEGRAM_FE_COPY.settingsTitle}</h1>

        <section className="mt-6 rounded-lg bg-white p-6 shadow-md" data-testid="telegram-settings">
          <h2 className="text-lg font-semibold">Telegram</h2>
          {linked ? (
            <p className="mt-2 text-sm text-gray-700" data-testid="telegram-linked-status">
              {TELEGRAM_FE_COPY.linked}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-700" data-testid="telegram-unlinked-status">
              {TELEGRAM_FE_COPY.unlinked}
            </p>
          )}

          <button
            type="button"
            onClick={() => void requestCode()}
            disabled={loading}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="generate-link-code"
          >
            {loading ? TELEGRAM_FE_COPY.generating : TELEGRAM_FE_COPY.generateCode}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-700" data-testid="link-code-error">
              {error}
            </p>
          )}

          {code && (
            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {TELEGRAM_FE_COPY.codeLabel}
              </p>
              <p
                className="mt-1 font-mono text-2xl font-semibold tracking-widest"
                data-testid="telegram-link-code"
              >
                {code.code}
              </p>
              <p className="mt-2 text-sm text-gray-600">{TELEGRAM_FE_COPY.codeHint}</p>
              <p className="mt-1 text-xs text-gray-500" data-testid="telegram-link-code-expiry">
                Vence: {new Date(code.expiresAt).toLocaleString('es-AR')}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
