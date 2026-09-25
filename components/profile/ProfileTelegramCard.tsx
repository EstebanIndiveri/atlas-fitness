import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UI_COPY } from '@/lib/copy/ui';
import { TELEGRAM_FE_COPY } from '@/lib/telegram/copy';
import type { TelegramLinkCodeResponse } from '@/types/auth';

interface ProfileTelegramCardProps {
  linked: boolean;
  telegramUserId: string | null;
  code: TelegramLinkCodeResponse | null;
  loading: boolean;
  error: string | null;
  onRequestCode: () => void;
}

/**
 * Renders the Perfil Telegram integration card and existing link-code flow.
 * @param props Real Telegram connection state and link-code callbacks.
 * @returns Integration card with honest linked/unlinked state and configuration action.
 * @example <ProfileTelegramCard linked={false} telegramUserId={null} code={null} loading={false} error={null} onRequestCode={() => undefined} />
 */
export function ProfileTelegramCard({
  linked,
  telegramUserId,
  code,
  loading,
  error,
  onRequestCode,
}: ProfileTelegramCardProps) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 font-serif text-xl font-semibold tracking-[-0.03em] text-ink">
        {UI_COPY.profileIntegrationsTitle}
      </h2>
      <Card data-testid="telegram-settings" className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-muted text-ink">
            ▻
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{UI_COPY.profileTelegramTitle}</h3>
              <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[0.65rem] font-semibold text-ink">
                {linked ? 'Conectado' : 'No vinculado'}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {linked && telegramUserId ? `ID ${telegramUserId}` : TELEGRAM_FE_COPY.unlinked}
            </p>
          </div>
        </div>

        {linked ? (
          <p className="mt-2 text-sm text-ink" data-testid="telegram-linked-status">
            {TELEGRAM_FE_COPY.linked}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink" data-testid="telegram-unlinked-status">
            {TELEGRAM_FE_COPY.unlinked}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink-muted">Estado de sincronización</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={onRequestCode}
            disabled={loading}
            data-testid="generate-link-code"
          >
            {loading ? TELEGRAM_FE_COPY.generating : 'Configurar'}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-danger" data-testid="link-code-error">
            {error}
          </p>
        ) : null}

        {code ? (
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
        ) : null}
      </Card>
    </section>
  );
}
