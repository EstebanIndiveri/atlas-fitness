export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  telegramUserId: string | null;
}

export interface SessionData {
  userId: number;
}

export interface TelegramLinkCodeResponse {
  code: string;
  expiresAt: string;
}
