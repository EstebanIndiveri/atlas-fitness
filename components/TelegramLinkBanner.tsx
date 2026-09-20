'use client';

import Link from 'next/link';
import { buttonClassName } from '@/components/ui/Button';
import { TELEGRAM_FE_COPY } from '@/lib/telegram/copy';

export function TelegramLinkBanner() {
  return (
    <div
      className="mb-6 rounded-lg border border-brand bg-brand-muted p-4"
      data-testid="telegram-link-banner"
    >
      <h2 className="text-sm font-semibold text-ink">{TELEGRAM_FE_COPY.bannerTitle}</h2>
      <p className="mt-1 text-sm text-ink">{TELEGRAM_FE_COPY.bannerBody}</p>
      <Link
        href="/dashboard/settings"
        className={buttonClassName({ variant: 'primary', className: 'mt-3' })}
        data-testid="telegram-link-banner-cta"
      >
        {TELEGRAM_FE_COPY.bannerCta}
      </Link>
    </div>
  );
}
