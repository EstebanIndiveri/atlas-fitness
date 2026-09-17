# ADR-001 — Sistema, stack, escala y riesgos

**Estado:** Aprobado (Squad Scrum, 2026-09-16)  
**Producto:** Atlas Fitness  
**Complementa:** ADR-002 (cliente), ADR-001b (hábito/motivación)

## Contexto

App fitness usable desde el día 1: log de entrenos (ejercicio/sets/reps/peso), historial+PR, catálogo con explicación+media URL, tip diario, mood/nota, web + Telegram. Un dominio, dos canales. Hermes Finance = referencia de patrones (pausado), no copia ciega.

## Decisión — estilo y límites

- **Estilo:** monólito modular Next.js App Router, capas feature-oriented: middleware sesión → `app/api/**` → `lib/` (dominio + adapters) → DB/externos.
- **Tenancy v1:** usuario personal; todo row con `user_id` (multi-user ready). Sin grupos/coach en MVP.
- **Canales:** misma API REST + webhook Telegram modular (thin route + handlers por comando). Mini App = Should (ADR-001b / ADR-002).
- **Fuera de MVP:** multi-grupo gym, wearables/HealthKit, upload media propia (solo URLs), offline sync gym, microservicios, Swift-only, unidades distintas de kg, nutrición/recetas, geofence.

## Stack

| Capa | Elección |
|------|----------|
| Runtime | Next.js App Router + TypeScript + React |
| API | Route handlers; errores `{ code, message }` tipados |
| Auth | Cookie sesión HMAC; link Telegram vía código |
| DB | Turso/libSQL + Drizzle; migraciones versionadas |
| Pesos | `weight_kg` decimal/numeric; asserts string decimal |
| TZ | Servidor `America/Argentina/Cordoba`; UI `es-AR` |
| PR | Calculado: max `weight_kg`; empate → más reciente. Sin tabla hasta que duela. `weight×reps` = Should |
| Telegram | Webhook + `bot_messages` (idempotencia) + `telegram_link_codes` |
| IA | Tip/consejo con **fallback** obligatorio |
| Jobs | Vercel crons + `CRON_SECRET` |
| Soft delete | workouts / sets / exercises custom |
| QA/CI | Jest + Playwright Must desde PR-00 |

## Plan de escala

### Ahora (MVP Must v2)

Auth, workouts/sets atómicos, catálogo seed+URLs, historial+PR, tip cron+fallback, link Telegram idempotente, soft delete, **sesión viva**, **notas/mood**, **streaks/nudges**, **Stories tip-card → CTA log**, CI+Playwright.

### ~3 meses

Sugerencia overload, gráficos, Mini App, rutinas casa/caminata, rate-limit durable, logs estructurados, handlers Telegram bien partidos.

### ~12 meses

Expo RN (mismos `/api/*`); HealthKit/Watch solo con import; offline con `client_mutation_id`; rutinas IA / coach con tenancy explícito. Seguir monólito modular.

## Riesgos (Hermes → no repetir)

| Sev. | Riesgo | Mitigación |
|------|--------|------------|
| Alta | TOCTOU en sets / último peso / PR | Escritura atómica + tests negativos |
| Alta | Webhook Telegram monolítico | Modular desde día 0 |
| Media | Rate-limit auth in-memory | Durable a 3m o ante abuso |
| Media | Sin CI | CI desde primer PR |
| Media | Fallos IA silenciosos | Fallback + log |
| Baja | Cron tips O(users) + chat global | Por `user_id` / chat linkeado |
| Baja | Float en pesos | Decimal + string en contratos |

## Consecuencias

- BE/FE/QA implementan contra contratos compartidos sin BFF.
- App Store / offline / HealthKit no bloquean MVP.
- Gobernanza de código: ver `AGENTS.md`.
