# Convenciones QA — Atlas Fitness

Reglas de testing, seed data, y criterios de aceptación para Must v2.

## Must Matrix (MVP v2)

| Feature | Alcance Must | QA Clave |
|---------|--------------|----------|
| **Auth** | Login + link Telegram | Session activa, cookie HMAC, códigos únicos |
| **Sesión Viva** | Workout activo (endedAt null) + agregar/editar/eliminar sets | Atómico, ownership checks, no modificar workout finalizado |
| **Notas/Mood** | Nota opcional + mood 1-5 al finalizar workout | Validación mood 1-5, campos opcionales, visible en historial |
| **Log Session** | Registrar entreno (ejercicio/sets/reps/peso) | Atómico, soft delete, no TOCTOU |
| **Tip Card** | Tip diario + Stories → CTA log | Fallback IA, visible, navegable |
| **Streaks** | Racha días consecutivos (TZ Cordoba) | TZ `America/Argentina/Cordoba`, conteo correcto, nudge |
| **Soft Delete** | Workouts, sets, exercises custom | Listados filtran `deleted_at IS NULL` |
| **PR (max weight_kg)** | Peso récord por ejercicio | Decimal string en asserts, empate → más reciente, badge visible en UI |
| **Telegram Idempotency** | Webhook sin duplicados | `update_id` en `bot_messages`, rollback/retry seguro |

## Seed Data

### Usuario QA

- Email: `qa@atlas.test`
- Password: `Test1234!` (seed en `lib/db/seed.ts`)
- Telegram: Usuario mock / webhook stub para tests e2e (sin red a Telegram)

### Ejercicios Seed

- **Press Banca** (Bench Press) — Pecho, URLs media
- **Sentadilla** (Squat) — Piernas, URLs media
- **Peso Muerto** (Deadlift) — Espalda, URLs media

### Workouts Históricos

- 3 sesiones pasadas con sets/reps/pesos variados
- PR establecido en cada ejercicio
- Una sesión con soft delete (`deleted_at` set)

## Telegram/IA en CI

- **Telegram**: Mock webhook; validar idempotencia con `update_id` duplicado
- **IA**: Stub API; retornar tip fallback en fallo

## Asserts Pesos

- **Tipo:** `weight_kg` como **decimal string** (`"80.5"`, `"100"`)
- **Validación:** No floats en comparaciones de dominio
- **Display:** Formatter `lib/format/weight.ts` → `"80.5 kg"`

## Zona Horaria

- **Canónica:** `America/Argentina/Cordoba`
- **Streaks:** Conteo de días según TZ Cordoba, no UTC
- **Display:** Formateo de fechas `es-AR`

## Playwright Must Scenarios

Flujos **ya shipped** (no “cuando se implemente”). Detalle de cómo correrlos en laptop/Box: `docs/engineering/local-dev.md`.

1. **Home / Landing** — Carga 200, título visible; copy PWA iOS “Agregar a Inicio”
2. **Auth Flow** — Login → Dashboard (`qa@atlas.test` / `Test1234!`)
3. **Log Workout** — Crear sesión → sets → finalizar → ver en historial
4. **Tip Card** — Tip diario visible, mood 1–5 (hidrata tras reload), CTA log
5. **Streaks** — Chip de racha visible, TZ `America/Argentina/Cordoba`
6. **Telegram** — link-code + webhook stub; `update_id` duplicado → `duplicate: true` (sin red a Telegram)

## Tests Unitarios Must

- `lib/format/weight.ts` — formatear/parsear/validar ✅
- `lib/services/*` — casos de uso con mocks
- Soft delete filters
- PR calculation (max weight, empate por fecha)
- TZ helpers (Cordoba)

## CI Pipeline

- ESLint + TypeScript strict (`tsc --noEmit`)
- Jest unitarios (todos verdes)
- Playwright smoke (al menos home)
- Build exitoso

## Branch Protection

- No push directo a `main` ni `develop`
- PR obligatorio con CI verde
- Code review de al menos un agente del squad
- Arquitectura aprueba cambios estructurales

---

Ver `AGENTS.md` §§5–6 y ADRs en `docs/architecture/`.
