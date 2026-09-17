import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  dailyCheckins,
  users,
  workoutSets,
  workouts,
  telegramLinkCodes,
  userStreaks,
} from '@/lib/db/schema';
import { upsertDailyCheckin, getDailyCheckin } from './daily-checkins';
import { AppError } from '@/types/errors';
import bcrypt from 'bcryptjs';

describe('Daily Checkins Service', () => {
  const TEST_DATE = '2026-09-17';
  let testUserId: number;

  beforeEach(async () => {
    // Delete in order respecting foreign keys
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Test User',
        email: `checkin-test-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    testUserId = user.id;
  });

  describe('upsertDailyCheckin', () => {
    it('should create new checkin when none exists', async () => {
      const checkin = await upsertDailyCheckin(testUserId, TEST_DATE, 4);

      expect(checkin.userId).toBe(testUserId);
      expect(checkin.localDate).toBe(TEST_DATE);
      expect(checkin.mood).toBe(4);
      expect(checkin.createdAt).toBeTruthy();
      expect(checkin.updatedAt).toBeTruthy();
    });

    it('should update existing checkin for same user and date', async () => {
      const first = await upsertDailyCheckin(testUserId, TEST_DATE, 3);
      const firstUpdatedAt = first.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await upsertDailyCheckin(testUserId, TEST_DATE, 5);

      expect(second.id).toBe(first.id);
      expect(second.mood).toBe(5);
      expect(second.createdAt).toEqual(first.createdAt);
      expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(firstUpdatedAt.getTime());
    });

    it('should be idempotent - multiple calls with same mood', async () => {
      const first = await upsertDailyCheckin(testUserId, TEST_DATE, 4);
      const second = await upsertDailyCheckin(testUserId, TEST_DATE, 4);
      const third = await upsertDailyCheckin(testUserId, TEST_DATE, 4);

      expect(second.id).toBe(first.id);
      expect(third.id).toBe(first.id);
      expect(second.mood).toBe(4);
      expect(third.mood).toBe(4);

      // Verify only one row exists
      const all = await db.select().from(dailyCheckins);
      expect(all.length).toBe(1);
    });

    it('should validate mood range 1-5', async () => {
      await expect(upsertDailyCheckin(testUserId, TEST_DATE, 0)).rejects.toThrow(AppError);
      await expect(upsertDailyCheckin(testUserId, TEST_DATE, 6)).rejects.toThrow(AppError);
      await expect(upsertDailyCheckin(testUserId, TEST_DATE, -1)).rejects.toThrow(AppError);
    });

    it('should allow different users same date', async () => {
      const [user2] = await db
        .insert(users)
        .values({
          name: 'User 2',
          email: 'user2@test.com',
          passwordHash: await bcrypt.hash('Test1234!', 10),
        })
        .returning();

      const checkin1 = await upsertDailyCheckin(testUserId, TEST_DATE, 3);
      const checkin2 = await upsertDailyCheckin(user2.id, TEST_DATE, 5);

      expect(checkin1.userId).toBe(testUserId);
      expect(checkin2.userId).toBe(user2.id);
      expect(checkin1.mood).toBe(3);
      expect(checkin2.mood).toBe(5);

      const all = await db.select().from(dailyCheckins);
      expect(all.length).toBe(2);
    });
  });

  describe('getDailyCheckin', () => {
    it('should return null when no checkin exists', async () => {
      const checkin = await getDailyCheckin(testUserId, TEST_DATE);
      expect(checkin).toBeNull();
    });

    it('should return checkin when exists', async () => {
      await upsertDailyCheckin(testUserId, TEST_DATE, 4);

      const checkin = await getDailyCheckin(testUserId, TEST_DATE);

      expect(checkin).not.toBeNull();
      expect(checkin?.mood).toBe(4);
      expect(checkin?.localDate).toBe(TEST_DATE);
    });

    it('should not return checkin for different user', async () => {
      const [user2] = await db
        .insert(users)
        .values({
          name: 'User 2',
          email: 'user2@test.com',
          passwordHash: await bcrypt.hash('Test1234!', 10),
        })
        .returning();

      await upsertDailyCheckin(testUserId, TEST_DATE, 4);

      const checkin = await getDailyCheckin(user2.id, TEST_DATE);
      expect(checkin).toBeNull();
    });
  });
});
