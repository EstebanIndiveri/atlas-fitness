/**
 * GET /api/stats/streak — authenticated streak snapshot.
 * Dates are Córdoba calendar days (YYYY-MM-DD).
 */
export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

/**
 * Nudge rule (Must): users active yesterday (Córdoba) but not yet today.
 * Freeze / revive is out of Must.
 */
export const STREAK_NUDGE_RULE = 'active_yesterday_not_today' as const;
export type StreakNudgeRule = typeof STREAK_NUDGE_RULE;

export const STREAK_NUDGE_KIND = 'streak_at_risk' as const;
export type StreakNudgeKind = typeof STREAK_NUDGE_KIND;

export interface StreakNudgeRunResult {
  date: string;
  rule: StreakNudgeRule;
  considered: number;
  recorded: number;
  skipped: number;
}
