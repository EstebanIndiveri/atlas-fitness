# ADR-003 — Gemini en sesión guiada + fallback determinista

**Estado:** Propuesto (Epic-E)  
**Producto:** Atlas Fitness  
**Complementa:** ADR-001 (IA con fallback obligatorio), ADR-001b (sesión viva)

## Contexto

Epic-E agrega rutinas seed + sesión guiada (sets, descanso, cierre). Al terminar un ejercicio, el producto pide “el siguiente” de la rutina. Hay `GEMINI_API_KEY` opcional; sin clave o con fallo de red no puede bloquear el flujo de hábito.

## Decisión

1. **Gemini solo server-side.** La clave vive en `GEMINI_API_KEY` (nunca `NEXT_PUBLIC_*`). El cliente llama `POST /api/workouts/:id/next-exercise`; el adapter en `lib/ai/` no se importa desde componentes client.
2. **Contrato de sugerencia:** el modelo elige el próximo `exerciseId` **entre los pendientes de la rutina** (o marca último). Si la respuesta es inválida, timeout, 4xx/5xx o no hay clave → **fallback determinista**: el siguiente ítem por `routine_exercises.sort_order`.
3. **Sesión = workout existente.** `workouts.routine_id` opcional; sets siguen `POST /api/workouts/:id/sets`. No hay tabla `sessions` paralela.
4. **Rutinas v1 = seed + GET.** `routines` + `routine_exercises` (orden, series/reps objetivo). CRUD de editor visual = Won't.

## Consecuencias

- Tests unitarios cubren fallback (sin key, error HTTP, JSON inválido) y el camino feliz con fetch mockeado.
- `.env.example` documenta la clave vacía; CI no inyecta Gemini.
- Copy de motivación de descanso/cierre es local (es-AR), no un rewrite de tips por IA.
