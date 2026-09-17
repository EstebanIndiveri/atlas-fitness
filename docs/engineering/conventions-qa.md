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
- Password: `Test1234!` (si se implementa password; sino link Telegram)
- Telegram: Usuario mock para tests e2e

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

1. **Home / Landing** — Carga 200, título visible
2. **Auth Flow** (cuando se implemente) — Login → Dashboard
3. **Log Workout** (cuando se implemente) — Crear sesión → ver en historial
4. **Tip Card** (cuando se implemente) — Ver tip → CTA funciona
5. **Streaks** (cuando se implemente) — Racha visible, actualizada

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
