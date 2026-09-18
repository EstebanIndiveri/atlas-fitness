# AI Integration

Gemini se usa **solo server-side** para sugerir el siguiente ejercicio de una rutina (`POST /api/workouts/:id/next-exercise`).

- Env: `GEMINI_API_KEY` (vacía = fallback). Nunca `NEXT_PUBLIC_*`.
- Sin clave, timeout o respuesta inválida → orden de `routine_exercises.sort_order`.
- Tips diarios **no** pasan por Gemini: `ensureTodayTip` sigue persistiendo `source = 'system'`.

Detalle: `docs/architecture/ADR-003-gemini-guided-session.md` y `docs/engineering/local-dev.md`.
