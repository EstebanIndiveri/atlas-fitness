'use client';

import Link from 'next/link';
import { TELEGRAM_FE_COPY } from '@/lib/telegram/copy';

export function TelegramLinkBanner() {
  return (
    <div
      className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4"
      data-testid="telegram-link-banner"
    >
      <h2 className="text-sm font-semibold text-blue-900">{TELEGRAM_FE_COPY.bannerTitle}</h2>
      <p className="mt-1 text-sm text-gray-700">{TELEGRAM_FE_COPY.bannerBody}</p>
      <Link
        href="/dashboard/settings"
        className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        data-testid="telegram-link-banner-cta"
      >
        {TELEGRAM_FE_COPY.bannerCta}
      </Link>
    </div>
  );
}
