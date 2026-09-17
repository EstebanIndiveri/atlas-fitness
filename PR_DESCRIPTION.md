# Phase 2: Auth Schema & Services

## Overview

Complete implementation of Phase 2 for Atlas Fitness with authentication, database schema, and comprehensive testing infrastructure. Auth is fully usable (register/login/logout/me) with HMAC session cookies, and Drizzle/Turso schema is ready for Must v2 domain including workouts (APIs not yet implemented per spec).

## Implementation Summary

### Database & Schema ✅
- **Drizzle ORM** with libSQL/Turso support
- **8 tables** with full foreign key relationships:
  - `users` (auth + profile)
  - `exercises` (system & custom, with soft delete)
  - `workouts` (sessions with mood/notes, soft delete)
  - `workout_sets` (with decimal weight_kg, soft delete)
  - `daily_tips` (date-based tips)
  - `telegram_link_codes` (short-lived codes for account linking)
  - `bot_messages` (idempotency for webhook)
  - `user_streaks` (minimal streak tracking, ready for expansion)
- **Migration system** with `npm run db:migrate`
- **Seed script** (`npm run db:seed`) with:
  - QA user: `qa@atlas.test` / `Test1234!`
  - 5 system exercises with fixed slugs (bench-press, squat, deadlift, overhead-press, barbell-row)

### Auth Services ✅ (TDD)
- **Register** with validation (email format, password strength 8+ chars with upper/lower/number)
- **Login** with bcrypt password verification
- **HMAC session cookies** (7-day expiry, HttpOnly, Lax SameSite)
- **Telegram link code** generation (10-minute expiry, 8-char codes)
- **Session middleware** with `requireAuth()` and `optionalAuth()` helpers
- **Error handling** with typed `AppError` (UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION | CONFLICT)

### API Routes ✅
- `POST /api/auth/register` → creates user + session
- `POST /api/auth/login` → validates credentials + session
- `POST /api/auth/logout` → clears session cookie
- `GET /api/auth/me` → returns current user (protected)
- `POST /api/auth/telegram/link-code` → generates link code (protected)

### Frontend (Minimal) ✅
- `/login` — Mobile-first login page (es-AR)
- `/register` — Registration with client-side validation
- `/dashboard` — Post-login placeholder with logout
- **Session gating**: Dashboard redirects to login when not authenticated

### Decimal/Weight Handling ✅
- `weight_kg` stored as **TEXT** (not float) to preserve precision
- `WeightKg` type with string-only utilities
- `lib/format/decimal.ts` for safe decimal operations
- `lib/format/weight.ts` improved with string normalization

### Testing ✅
- **Jest (22/22 passing)**:
  - Auth service unit tests (register, login, getUserById, generateLinkCode)
  - Validation (email, password, conflicts)
  - Weight formatting tests
- **Playwright (5/8 passing)**:
  - ✅ Home page tests (3/3)
  - ✅ Auth validation tests (2/2)
  - ⚠️ Full auth flow tests (0/3) — see Known Issues below

### CI/CD ✅
- TypeScript strict mode (no errors)
- ESLint passing (zero warnings/errors)
- Jest passing (100%)
- Build successful

## How to Run

### Prerequisites
```bash
# Required environment variables
cp .env.example .env
# Edit .env and set:
# - TURSO_DATABASE_URL (or use file:./local.db for local dev)
# - TURSO_AUTH_TOKEN (if using Turso)
# - SESSION_SECRET (generate with: openssl rand -hex 32)
```

### Setup
```bash
# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### Development
```bash
# Start dev server
npm run dev

# Run Jest tests
npm test

# Run Playwright e2e (requires build)
npm run test:e2e

# Typecheck
npm run typecheck

# Lint
npm run lint
```

### Test Credentials
- **Email**: `qa@atlas.test`
- **Password**: `Test1234!`

### System Exercise Slugs
- `bench-press` — Press Banca (Pecho)
- `squat` — Sentadilla (Piernas)
- `deadlift` — Peso Muerto (Espalda)
- `overhead-press` — Press Militar (Hombros)
- `barbell-row` — Remo con Barra (Espalda)

## Known Issues / Tech Debt

### Playwright E2E Tests (3 failing)
**Issue**: Auth flow tests involving dashboard redirects are failing due to cookie/session persistence in test environment.

**What's failing**:
- Full register → login → logout flow
- Session persistence after redirect
- QA user login flow

**Root cause**: Client-side `useEffect` in dashboard fetches `/api/auth/me` and redirects to `/login` on failure. In Playwright tests, cookies set via `Set-Cookie` header aren't consistently available on next navigation, causing false redirects.

**Workaround options** (not implemented in this PR):
1. Use Next.js middleware for server-side auth checks
2. Add `waitForResponse('/api/auth/me')` in tests
3. Use Playwright `storageState` to persist cookies between navigations

**Impact**: LOW — Auth functionality works correctly in manual testing and via direct API calls. Only affects automated e2e tests.

## Out of Scope (as specified)
- ❌ Workout/sets REST APIs
- ❌ Tip-card UI product
- ❌ Streak cron jobs
- ❌ Telegram webhook handlers
- ❌ Live session UI
- ❌ Charts/analytics
- ❌ Mini App
- ❌ Web Push notifications

## Architecture Decisions

### Why HMAC cookies instead of JWT?
- Simpler (no external dependencies)
- No exposure risk (cookies are HttpOnly)
- Stateless yet secure
- 7-day expiry handles session lifecycle

### Why Drizzle over Prisma?
- Better TypeScript inference
- Lighter weight
- Better Turso/libSQL support
- SQL-first approach (easier to optimize)

### Why soft delete?
- Maintains referential integrity
- Enables audit trails
- User can "undo" workout deletion
- Follows ADR-001 requirement

### Why text/string for weight_kg?
- Avoids floating-point precision errors
- Critical for PR (personal record) calculations
- SQLite NUMERIC becomes string in JS anyway
- Follows ADR-001 requirement

## Security Considerations

### Implemented ✅
- Password hashing with bcrypt (10 rounds)
- HMAC-signed session cookies
- HttpOnly cookies (no JS access)
- SameSite=Lax (CSRF protection)
- Email normalization (lowercase)
- Strong password validation
- Rate limiting ready (in-memory for dev, needs durable for prod)

### Future Considerations
- Rate limiting with durable storage (Upstash Redis)
- CAPTCHA on registration
- Email verification flow
- 2FA/MFA support
- Password reset flow
- Account lockout after N failed attempts

## Database Migration Path

### Local Development
```bash
# Uses file:./local.db (SQLite)
npm run db:migrate
npm run db:seed
```

### CI
```bash
# Set TURSO_DATABASE_URL to :memory: or use test fixture
export TURSO_DATABASE_URL=:memory:
npm run db:migrate
npm test
```

### Production
```bash
# Set real Turso credentials
export TURSO_DATABASE_URL=libsql://your-db.turso.io
export TURSO_AUTH_TOKEN=your-token
npm run db:migrate
# DO NOT run seed in production!
```

## Code Organization

Follows `AGENTS.md` conventions:
- **Routes thin** (`app/api/**`) — validation + service call + error mapping
- **Services fat** (`lib/services/**`) — business logic, TDD
- **Shared types** (`types/**`) — FE/BE contracts
- **Utils** (`lib/format/**`, `lib/auth/**`) — reusable helpers
- **Max ~200 lines** per file (adhered to)
- **TypeScript strict** (zero `any` except in typed error handling)

## Testing Coverage

### Unit Tests (Jest)
- ✅ Auth service (register, login, getUserById, generateLinkCode)
- ✅ Password validation (weak, strong, edge cases)
- ✅ Email validation
- ✅ Conflict handling (duplicate email)
- ✅ Unauthorized handling (wrong password, missing user)
- ✅ Link code expiry logic
- ✅ Weight formatting/parsing

### E2E Tests (Playwright)
- ✅ Home page load + content
- ✅ Invalid login credentials → error display
- ✅ Weak password registration → validation error
- ⚠️ Full auth flow (see Known Issues)

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **TOCTOU in sets/PR** | High | Atomic writes in future workout APIs |
| **Rate-limit in-memory** | Medium | Migrate to durable store (Upstash Redis) |
| **E2E test flakiness** | Low | Cookie persistence workaround or middleware |
| **Session secret rotation** | Medium | Document rotation procedure |
| **Soft delete not filtered** | High | Query helpers enforce `deleted_at IS NULL` |

## DoD Checklist

- [x] CI green (lint ✅, typecheck ✅, jest ✅, build ✅)
- [x] Migrations apply locally
- [~] Playwright e2e passing (5/8, auth flows need fix)
- [x] PR description complete (this doc)
- [x] Seed script with QA user + exercises
- [x] Small files (<250 lines)
- [x] TDD for services
- [x] TypeScript strict
- [x] Error codes typed
- [x] Session HMAC working
- [x] Soft delete schema ready
- [x] Decimal weight handling

## Next Steps (Phase 3)

1. **Fix Playwright cookie issues** (middleware or test adjustments)
2. **Workout APIs** (POST/GET/DELETE with atomic sets)
3. **PR calculation** (max weight per exercise)
4. **Tip card UI** (daily tip display + CTA)
5. **Streak calculation** (Cordoba TZ, cron job)
6. **Telegram webhook** (modular handlers, idempotency)

## Evidence

### Manual Testing
- ✅ Registration flow (new user created, session set)
- ✅ Login flow (existing user, session restored)
- ✅ Logout (session cleared)
- ✅ Dashboard auth gate (redirect when not logged in)
- ✅ API validation (weak password, duplicate email)

### Automated Testing
```bash
$ npm test
Test Suites: 2 passed, 2 total
Tests:       22 passed, 22 total

$ npm run typecheck
# No errors

$ npm run lint
# No errors

$ npm run build
✓ Compiled successfully
```

---

**Ready for review!** 🚀

cc @EstebanIndiveri @Arquitectura @QA
