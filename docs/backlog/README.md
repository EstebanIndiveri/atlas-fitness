# Backlog — Atlas Fitness

Fuente de verdad de alcance junto a los ADRs en `docs/architecture/`.  
PO Scrum prioriza; Arquitectura vela por límites técnicos (`AGENTS.md`).

## Must v2 (MVP usable + hábito)

- Auth (register/login/logout/me) + link Telegram
- Log sesión: workout + sets (reps, `weight_kg` decimal)
- Sesión activa en vivo (cronómetro + check sets)
- Notas / mood en workout
- Historial + PR (max `weight_kg`; empate → más reciente)
- Catálogo ejercicios (explicación + image/video URL; seed sistema)
- Tip del día (cron + fallback sin IA) como **tip-card** en Home → CTA log
- Streaks + nudges Telegram (TZ `America/Argentina/Cordoba`, idempotentes)
- Soft delete workouts/sets
- CI: lint + tsc + Jest + Playwright flujos Must
- PWA instalable (manifest/iconos)

## Should

- Telegram Mini App (mismos contratos + `initData`)
- Sugerencia de peso (último + Δ) y gráficos de historial
- Rutinas alternativas casa/caminata (`kind`)
- Onboarding 1ª semana
- Rate-limit auth durable

## Could

- Noticias/IA diarias (sobre tips)
- Rutinas IA / mesocycles
- Social / coach / wearables (post tenancy)

## Won't (v1 / MVP)

- Marketplace gyms, app nativa Swift-only, dieta completa, recetas, calorías/déficit como producto
- GPS / geofence
- Offline sync gym
- Feed tipo Instagram completo

## Orden de entrega sugerido (kickoff)

1. Scaffold + `AGENTS.md` + CI + branching (`develop`)
2. Auth + schema Drizzle + seed exercises
3. Workouts/sets + PR + soft delete (TDD)
4. Historial + catálogo UI
5. Tip-card + cron tip
6. Sesión viva + notas/mood
7. Streaks + nudge cron
8. Telegram bot modular (log/resumen/reminder/link)
9. PWA manifest + Playwright Must suite

Detalle de contratos: ver brief Backend en el informe unificado PO / issues cuando existan.

## Handoffs

- [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md) — dirección de producto Atlas Adaptive Core V1: visión, DATA HONESTY RULE, roadmap dos tracks, MoSCoW V1, DoD y brief para agentes.
