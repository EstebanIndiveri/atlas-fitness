'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CheckInClientError,
  fetchTodayCheckIn,
  recordCheckIn,
  type DailyCheckInInput,
  type DailyCheckInResponse,
} from '@/lib/api/checkin';
import { TODAY_COPY } from '@/lib/copy/today';

type UseDailyCheckinResult = {
  checkin: DailyCheckInResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => void;
  submit: (input: DailyCheckInInput) => Promise<DailyCheckInResponse | null>;
};

function mapCheckinLoadError(error: unknown): string {
  if (error instanceof CheckInClientError && error.kind === 'unauthorized') {
    return TODAY_COPY.checkinSessionExpired;
  }

  return TODAY_COPY.checkinError;
}

function mapCheckinSubmitError(error: unknown): string {
  if (error instanceof CheckInClientError) {
    if (error.kind === 'validation') {
      return error.message;
    }
    if (error.kind === 'unauthorized') {
      return TODAY_COPY.checkinSessionExpired;
    }
  }

  return TODAY_COPY.checkinSaveError;
}

/**
 * Loads and records the authenticated user's daily check-in.
 *
 * @returns Check-in data, loading/saving/error state, reload, and submit helpers.
 * @example
 * const { checkin, submit } = useDailyCheckin();
 * await submit({ mood: 4, energy: 'medium', note: 'Buen entrenamiento.' });
 */
export function useDailyCheckin(): UseDailyCheckinResult {
  const [checkin, setCheckin] = useState<DailyCheckInResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const mountedRef = useRef(false);
  const mutationVersionRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const mutationVersionAtStart = mutationVersionRef.current;

      try {
        const data = await fetchTodayCheckIn();
        if (!cancelled && mutationVersionAtStart === mutationVersionRef.current) {
          setCheckin(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled && mutationVersionAtStart === mutationVersionRef.current) {
          setCheckin(null);
          setError(mapCheckinLoadError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setRequestId((current) => current + 1);
  }, []);

  const submit = useCallback(async (input: DailyCheckInInput): Promise<DailyCheckInResponse | null> => {
    if (mountedRef.current) {
      setSaving(true);
      setError(null);
    }

    try {
      const saved = await recordCheckIn(input);
      if (mountedRef.current) {
        mutationVersionRef.current += 1;
        setCheckin(saved);
        setError(null);
      }
      return saved;
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(mapCheckinSubmitError(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, []);

  return { checkin, loading, saving, error, reload, submit };
}
