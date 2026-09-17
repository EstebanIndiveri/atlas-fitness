'use client';

import { useCallback, useState } from 'react';
import type { TelegramLinkCodeResponse } from '@/types/auth';

interface UseLinkCodeResult {
  code: TelegramLinkCodeResponse | null;
  loading: boolean;
  error: string | null;
  requestCode: () => Promise<void>;
}

export function useLinkCode(): UseLinkCodeResult {
  const [code, setCode] = useState<TelegramLinkCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/telegram/link-code', { method: 'POST' });
      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message: unknown }).message)
            : 'Error al generar el código';
        setError(message);
        return;
      }

      const payload = data as TelegramLinkCodeResponse;
      setCode(payload);
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { code, loading, error, requestCode };
}
