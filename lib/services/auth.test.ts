import { describe, it, expect, beforeEach } from '@jest/globals';
import * as authService from './auth';
import { db } from '@/lib/db/client';
import { users, telegramLinkCodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Auth Service', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(telegramLinkCodes);
    await db.delete(users);
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test1234!',
      };

      const user = await authService.register(input);

      expect(user.id).toBeDefined();
      expect(user.name).toBe(input.name);
      expect(user.email).toBe(input.email);
      expect(user.telegramUserId).toBeNull();

      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      expect(dbUser).toBeDefined();
      expect(dbUser?.passwordHash).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe(input.password);
    });

    it('should throw CONFLICT error for duplicate email', async () => {
      const input = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'Test1234!',
      };

      await authService.register(input);

      await expect(authService.register(input)).rejects.toThrow();
      try {
        await authService.register(input);
      } catch (error: any) {
        expect(error.code).toBe('CONFLICT');
        expect(error.message).toContain('already exists');
      }
    });

    it('should throw VALIDATION error for weak password', async () => {
      const input = {
        name: 'Test User',
        email: 'weak@example.com',
        password: '123',
      };

      await expect(authService.register(input)).rejects.toThrow();
      try {
        await authService.register(input);
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION');
      }
    });

    it('should throw VALIDATION error for invalid email', async () => {
      const input = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'Test1234!',
      };

      await expect(authService.register(input)).rejects.toThrow();
      try {
        await authService.register(input);
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION');
      }
    });
  });

  describe('login', () => {
    const testUser = {
      name: 'Login Test',
      email: 'login@example.com',
      password: 'Test1234!',
    };

    beforeEach(async () => {
      await authService.register(testUser);
    });

    it('should return user for valid credentials', async () => {
      const user = await authService.login({
        email: testUser.email,
        password: testUser.password,
      });

      expect(user.email).toBe(testUser.email);
      expect(user.name).toBe(testUser.name);
    });

    it('should throw UNAUTHORIZED for wrong password', async () => {
      await expect(
        authService.login({
          email: testUser.email,
          password: 'WrongPassword123!',
        }),
      ).rejects.toThrow();

      try {
        await authService.login({
          email: testUser.email,
          password: 'WrongPassword123!',
        });
      } catch (error: any) {
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw UNAUTHORIZED for non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: testUser.password,
        }),
      ).rejects.toThrow();

      try {
        await authService.login({
          email: 'nonexistent@example.com',
          password: testUser.password,
        });
      } catch (error: any) {
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('getUserById', () => {
    it('should return user for valid id', async () => {
      const registered = await authService.register({
        name: 'Test User',
        email: 'getbyid@example.com',
        password: 'Test1234!',
      });

      const user = await authService.getUserById(registered.id);

      expect(user).toBeDefined();
      expect(user?.id).toBe(registered.id);
      expect(user?.email).toBe(registered.email);
    });

    it('should return null for non-existent id', async () => {
      const user = await authService.getUserById(99999);
      expect(user).toBeNull();
    });
  });

  describe('generateLinkCode', () => {
    it('should generate a unique code with expiration', async () => {
      const user = await authService.register({
        name: 'Link Test',
        email: 'link@example.com',
        password: 'Test1234!',
      });

      const result = await authService.generateLinkCode(user.id);

      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.expiresAt).toBeDefined();

      const expiresDate = new Date(result.expiresAt);
      expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create unused link code in database', async () => {
      const user = await authService.register({
        name: 'Link Test 2',
        email: 'link2@example.com',
        password: 'Test1234!',
      });

      const result = await authService.generateLinkCode(user.id);

      const dbCode = await db.query.telegramLinkCodes.findFirst({
        where: eq(telegramLinkCodes.code, result.code),
      });

      expect(dbCode).toBeDefined();
      expect(dbCode?.userId).toBe(user.id);
      expect(dbCode?.used).toBe(false);
    });

    it('should expire after configured duration', async () => {
      const user = await authService.register({
        name: 'Expiry Test',
        email: 'expiry@example.com',
        password: 'Test1234!',
      });

      const result = await authService.generateLinkCode(user.id);

      const expiresDate = new Date(result.expiresAt);
      const now = new Date();
      const diffMinutes = (expiresDate.getTime() - now.getTime()) / 1000 / 60;

      expect(diffMinutes).toBeGreaterThan(9);
      expect(diffMinutes).toBeLessThan(11);
    });
  });
});
