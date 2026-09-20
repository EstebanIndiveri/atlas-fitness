# ADR-004 — Sesiones HMAC revocables (`sessions`)

**Estado:** Aprobado (Squad Scrum / PO, 2026-09-18)  
**Producto:** Atlas Fitness  
**Complementa:** ADR-001 (cookie HMAC), P0.1 (`SESSION_SECRET` fail-closed), P1.1 (`docs/codebase/CONCERNS.md`)

## Contexto

P0.1 exige `SESSION_SECRET` y firma HMAC. El payload de la cookie seguía siendo
solo `userId`: dos logins del mismo usuario producían el mismo token; el
servidor no validaba `iat`/`exp`; `Max-Age` era solo una instrucción al
navegador; logout borraba la cookie del cliente y **no** invalidaba un token
robado.

Hacía falta un modelo de sesión con:

- payload `userId` + `sessionId` aleatorio + `iat` + `exp` (alineado a 7 días);
- HMAC sobre el payload completo;
- rechazo de firma inválida, campos faltantes y `exp` vencido;
- **revocación durable** en servidor (logout y, más adelante, cambio de
  contraseña).

Se evaluó un entero `sessionVersion` en `users` (bump en logout). Ese diseño
revoca **todas** las sesiones del usuario de golpe, no identifica el token
actual, y mezcla autenticación con el row de perfil. El PO lo rechazó.

Esta tabla **no** es la sesión guiada de entrenamiento (ADR-003: workout +
`routine_id`). Son filas de **sesión de autenticación**.

## Decisión

1. **Tabla durable `sessions`** (Drizzle + migración Turso/SQLite), no
   `sessionVersion` en `users` y no un Map in-memory.
2. Columnas mínimas: `id` (PK = `sessionId` opaco, cryptographically random),
   `user_id` (FK `users`), `created_at`, `expires_at`, `revoked_at` nullable.
3. Cookie HMAC: `{ userId, sessionId, iat, exp }`. `exp − iat` = 7 días, igual
   que `Max-Age`.
4. **Modelo multi-dispositivo:** cada login/register inserta una fila nueva.
   Logout revoca **solo** el `sessionId` de la cookie actual (`revoked_at`).
   Otras sesiones del mismo usuario siguen vigentes. Cambio de contraseña
   (cuando exista el endpoint) revocará todas las filas activas del usuario.
5. **Validación:** decode (Node y Edge/WebCrypto) rechaza firma, payload
   incompleto y `exp` pasado. `requireAuth` (Node) además exige que la fila
   exista, no esté revocada y no haya expirado en DB. El proxy de navegación
   valida HMAC + `exp` sin consultar DB (Edge-compatible); las APIs son la
   frontera de revocación.

## Consecuencias

- Migración versionada `0006_sessions` junto al schema Drizzle.
- Login/register persisten la fila **antes** de emitir `Set-Cookie`.
- Logout: revoke server-side → luego `Max-Age=0`.
- Tests: cookie expirada → 401; fila revocada → 401; logins sucesivos con
  `sessionId` distintos; reutilizar cookie post-logout → 401.
- Tokens emitidos solo con `{ userId }` (pre-P1.1) dejan de ser válidos.
- P1.2 (ownership de ejercicios/rutinas) queda fuera de este ADR.
