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

export interface AuthProfile extends AuthUser {
  createdAt: string;
  activeTrainingPlanId: number | null;
}

export interface SessionData {
  userId: number;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface TelegramLinkCodeResponse {
  code: string;
  expiresAt: string;
}
