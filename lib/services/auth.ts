import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/client';
import { users, telegramLinkCodes } from '@/lib/db/schema';
import { AppError } from '@/types/errors';
import type { RegisterInput, LoginInput, AuthUser, TelegramLinkCodeResponse } from '@/types/auth';

const SALT_ROUNDS = 10;
const LINK_CODE_LENGTH = 8;
const LINK_CODE_EXPIRY_MINUTES = 10;

/**
 * Validates password strength
 */
function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new AppError('VALIDATION', 'Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    throw new AppError('VALIDATION', 'Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    throw new AppError('VALIDATION', 'Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    throw new AppError('VALIDATION', 'Password must contain at least one number');
  }
}

/**
 * Validates email format
 */
function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('VALIDATION', 'Invalid email format');
  }
}

/**
 * Converts DB user to AuthUser (without sensitive fields)
 */
function toAuthUser(user: typeof users.$inferSelect): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    telegramUserId: user.telegramUserId,
  };
}

/**
 * Registers a new user
 */
export async function register(input: RegisterInput): Promise<AuthUser> {
  validateEmail(input.email);
  validatePassword(input.password);

  if (!input.name || input.name.trim().length < 2) {
    throw new AppError('VALIDATION', 'Name must be at least 2 characters long');
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  });

  if (existingUser) {
    throw new AppError('CONFLICT', 'User with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const [newUser] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      passwordHash,
    })
    .returning();

  return toAuthUser(newUser);
}

/**
 * Logs in a user with email and password
 */
export async function login(input: LoginInput): Promise<AuthUser> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  });

  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password');
  }

  return toAuthUser(user);
}

/**
 * Gets a user by ID
 */
export async function getUserById(userId: number): Promise<AuthUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

/**
 * Generates a random alphanumeric code
 */
function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generates a Telegram link code for a user
 */
export async function generateLinkCode(userId: number): Promise<TelegramLinkCodeResponse> {
  const code = generateRandomCode(LINK_CODE_LENGTH);
  const expiresAt = new Date(Date.now() + LINK_CODE_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(telegramLinkCodes).values({
    userId,
    code,
    expiresAt,
    used: false,
  });

  return {
    code,
    expiresAt: expiresAt.toISOString(),
  };
}
