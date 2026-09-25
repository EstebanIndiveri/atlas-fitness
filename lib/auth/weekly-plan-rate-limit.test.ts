import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_WEEKLY_PLAN_GENERATE_LIMIT,
  MAX_WEEKLY_PLAN_GENERATE_LIMIT,
  getWeeklyPlanGenerateLimit,
  weeklyPlanGenerateRateLimitKey,
} from './weekly-plan-rate-limit';

describe('weekly plan generation rate-limit policy', () => {
  it('defaults to five generations per minute', () => {
    expect(getWeeklyPlanGenerateLimit({})).toBe(DEFAULT_WEEKLY_PLAN_GENERATE_LIMIT);
    expect(DEFAULT_WEEKLY_PLAN_GENERATE_LIMIT).toBe(5);
  });

  it('honors positive overrides without allowing a quota above the hard maximum', () => {
    expect(getWeeklyPlanGenerateLimit({ WEEKLY_PLAN_GENERATE_PER_MINUTE: '3' })).toBe(3);
    expect(getWeeklyPlanGenerateLimit({ WEEKLY_PLAN_GENERATE_PER_MINUTE: '999' }))
      .toBe(MAX_WEEKLY_PLAN_GENERATE_LIMIT);
    expect(getWeeklyPlanGenerateLimit({ WEEKLY_PLAN_GENERATE_PER_MINUTE: '0' })).toBe(5);
  });

  it('isolates durable buckets by both authenticated user and client IP', () => {
    expect(weeklyPlanGenerateRateLimitKey(42, '203.0.113.8'))
      .toBe('weekly-plan-generate:42:203.0.113.8');
    expect(weeklyPlanGenerateRateLimitKey(43, '203.0.113.8'))
      .not.toBe(weeklyPlanGenerateRateLimitKey(42, '203.0.113.8'));
    expect(weeklyPlanGenerateRateLimitKey(42, '198.51.100.8'))
      .not.toBe(weeklyPlanGenerateRateLimitKey(42, '203.0.113.8'));
  });
});
