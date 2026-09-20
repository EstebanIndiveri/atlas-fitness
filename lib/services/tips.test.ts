import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import { dailyTips } from '@/lib/db/schema';
import {
  getTodayTip,
  ensureTodayTip,
  createTip,
  getOrCreateTodayTip,
} from './tips';
import { AppError } from '@/types/errors';

describe('Tips Service', () => {
  const TEST_DATE = '2026-09-17';

  beforeEach(async () => {
    await db.delete(dailyTips);
  });

  describe('createTip', () => {
    it('should create a tip with given date', async () => {
      const tip = await createTip(TEST_DATE, 'Test tip', 'system');

      expect(tip.date).toBe(TEST_DATE);
      expect(tip.body).toBe('Test tip');
      expect(tip.source).toBe('system');
    });

    it('should fail when date already exists', async () => {
      await createTip(TEST_DATE, 'First tip', 'system');

      await expect(createTip(TEST_DATE, 'Duplicate', 'system')).rejects.toThrow(AppError);
    });
  });

  describe('getTodayTip', () => {
    it('should return null when no tip exists for date', async () => {
      const tip = await getTodayTip(TEST_DATE);
      expect(tip).toBeNull();
    });

    it('should return the tip for the given date', async () => {
      await createTip(TEST_DATE, 'Daily tip', 'system');

      const tip = await getTodayTip(TEST_DATE);
      expect(tip).not.toBeNull();
      expect(tip?.body).toBe('Daily tip');
      expect(tip?.date).toBe(TEST_DATE);
    });
  });

  describe('ensureTodayTip', () => {
    it('should create tip when none exists', async () => {
      const tip = await ensureTodayTip(TEST_DATE, null);

      expect(tip.date).toBe(TEST_DATE);
      expect(tip.source).toBe('system');
      expect(tip.body.length).toBeGreaterThan(0);
    });

    it('should return existing tip if one exists', async () => {
      const existing = await createTip(TEST_DATE, 'Existing tip', 'ai');

      const tip = await ensureTodayTip(TEST_DATE, null);

      expect(tip.id).toBe(existing.id);
      expect(tip.body).toBe('Existing tip');
      expect(tip.source).toBe('ai');
    });

    it('should use AI generated tip when provided', async () => {
      const aiContent = 'AI generated motivational tip';
      const tip = await ensureTodayTip(TEST_DATE, aiContent);

      expect(tip.body).toBe(aiContent);
      expect(tip.source).toBe('ai');
    });

    it('should fallback to system tip when AI content is empty string', async () => {
      const tip = await ensureTodayTip(TEST_DATE, '');

      expect(tip.source).toBe('system');
      expect(tip.body.length).toBeGreaterThan(0);
    });

    it('should be idempotent when called multiple times', async () => {
      const tip1 = await ensureTodayTip(TEST_DATE, null);
      const tip2 = await ensureTodayTip(TEST_DATE, null);

      expect(tip1.id).toBe(tip2.id);
      expect(tip1.body).toBe(tip2.body);
    });
  });

  describe('getOrCreateTodayTip', () => {
    it('should return existing tip', async () => {
      await createTip(TEST_DATE, 'Existing', 'system');

      const tip = await getOrCreateTodayTip(TEST_DATE);

      expect(tip.body).toBe('Existing');
    });

    it('should create new tip with fallback', async () => {
      const tip = await getOrCreateTodayTip(TEST_DATE);

      expect(tip.date).toBe(TEST_DATE);
      expect(tip.source).toBe('system');
    });
  });
});
