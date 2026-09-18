'use client';

import { useCallback, useEffect, useState } from 'react';
import { playSessionCue } from '@/lib/session/feedback';

export function useRestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [active, setActive] = useState(false);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) {
      setRemaining(0);
      setActive(false);
      return;
    }
    setRemaining(seconds);
    setActive(true);
  }, []);

  const skip = useCallback(() => {
    setRemaining(0);
    setActive(false);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setActive(false);
          playSessionCue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  return { remaining, active, start, skip };
}
