import { STREAK_COPY } from '@/lib/copy/streak';

export type StreakTone = 'zero' | 'active' | 'record';

export function daysLabel(count: number): string {
  return count === 1 ? 'día' : 'días';
}

export function streakTone(currentStreak: number, longestStreak: number): StreakTone {
  if (currentStreak <= 0) {
    return 'zero';
  }
  if (currentStreak >= 2 && currentStreak >= longestStreak) {
    return 'record';
  }
  return 'active';
}

export function streakDelightMessage(currentStreak: number, longestStreak: number): string {
  const tone = streakTone(currentStreak, longestStreak);
  if (tone === 'zero') {
    return STREAK_COPY.zeroBody;
  }
  if (tone === 'record') {
    return STREAK_COPY.recordBody;
  }
  if (currentStreak === 1) {
    return STREAK_COPY.firstDay;
  }
  return STREAK_COPY.keepGoing;
}

export function streakAriaLabel(currentStreak: number, longestStreak: number): string {
  return [
    STREAK_COPY.regionLabel,
    `${STREAK_COPY.currentLabel}: ${currentStreak} ${daysLabel(currentStreak)}`,
    `${STREAK_COPY.longestLabel}: ${longestStreak} ${daysLabel(longestStreak)}`,
  ].join('. ');
}
