# ADR-001b — Delta hábito / motivación (Must v2)

**Estado:** Aprobado (Squad Scrum, 2026-09-17)  
**Base:** ADR-001 + ADR-002 intactos

## Must v2 (además del logger)

| # | Idea | MoSCoW | Notas |
|---|------|--------|-------|
| 4 | Sesión activa en vivo | Must | Timer FE; workout `ended_at=null` |
| 7 | Notas / mood | Must | Ya en PATCH workout |
| 3 | Streaks / nudges | Must | TZ Córdoba; cron nudge idempotente; chat por usuario |
| 2 | Stories tip-card | Must liviano | 1 card tip → CTA log (no feed social) |

## Should

Mini App Telegram (`initData` HMAC), sugerencia peso + gráficos, rutinas casa/caminata (`workout.kind`).

## Could

Noticias/IA diarias (extiende tips + fallback).

## Won't MVP

Calorías/déficit, recetas, GPS/geofence.

## NFR Mini App (cuando entre)

Mismos `/api/*`; validar `initData` (HMAC, TTL corto); rate-limit por `telegram_user_id`; sin BFF duplicado.
