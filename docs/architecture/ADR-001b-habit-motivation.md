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

---

## Addendum v0.9.0 — actividad de hábitos registrada (sincronización, 2026-09-27)

**Estado:** adendum **append-only**; el texto anterior de este ADR queda intacto y sin reescritura. **No** se crea un ADR nuevo: `D1 = NO` (catálogo cerrado) y `D3 = NO` (sin backdating) son **ausencias** deliberadas, y un ADR para una capacidad que no se construyó sería ruido documental. Este addendum resuelve la contradicción interna del brief v0.9.0 (§7.2 vs §14.2 vs §7.4) **contra el código integrado en `develop`**, y registra las reconciliaciones que esta wave produjo. Cada afirmación de acá es verificable abriendo un archivo del merge.

### A1. Colocación de archivos — §14.2 es la autoritativa, no §7.2

El brief (§7.2) presenta tres firmas juntas como si las tres vivieran en el módulo nuevo `lib/services/habit-activity.ts`. **El código implementa §14.2.** Las tres existen, pero en **dos archivos**:

| Símbolo | Rol | Ubicación real |
|---|---|---|
| `computeHabitActivity` | núcleo puro | `lib/services/habit-activity.ts` |
| `getHabitActivityForUser` | loader de caso de uso | `lib/services/habit-activity.ts` |
| `loadHabitActivityInWindow` | lectura acotada | `lib/services/habit-logs.ts` |

**Por qué:** `lib/services/habit-logs.ts` sigue siendo el **único** módulo que toca la tabla `habit_logs` (es también donde viven `getHabitLogsForDate`, `getTodayHabitLogs` y `setHabitLog`), y `lib/services/habit-activity.ts` queda como módulo de **dominio puro y sin DB** — su única importación desde la capa de datos es el propio loader acotado — con la misma forma que el ya probado `lib/services/weekly-consistency.ts`. Eso es lo que permite testear la métrica sin DB. §7.2 sigue siendo válido como **ilustración** del contrato: su bloque de código nombra las tres firmas —incluido `HabitActivityInput`, el tipo que la función pura recibe— pero las presenta agrupadas como si todas vivieran en `habit-activity.ts`, cuando `loadHabitActivityInWindow` vive en `lib/services/habit-logs.ts` (§14.2). La tabla de arriba registra la ubicación real de cada una.

### A2. Regla de performance de §7.4 — decisión registrada

`loadHabitActivityInWindow` emite **exactamente una** consulta de rango, acotada por `userId` y por `local_date` entre el inicio y el fin de la ventana, ordenada por fecha; el agrupamiento posterior es **una sola pasada en memoria**. Una ventana de 90 días cuesta la misma única consulta que una de un día: **no hay N+1**.

**No** se reutiliza `loadActiveDates`, y esto es deliberado y está escrito en el JSDoc del loader: esa función responde **otra pregunta** (excluye hábitos) y es **unbounded**; "unificarlas" reintroduciría la semántica equivocada y perdería la cota. Verificado: §7.4 exige que la regla quede en el JSDoc, y el JSDoc **existe** — pero sobre el **loader** `loadHabitActivityInWindow` en `lib/services/habit-logs.ts`, no sobre un "service" como decía §7.4. Se registra la ubicación real.

### A3. Ventanas: idénticas por construcción a las del resto del producto

Las ventanas de `week` (lunes primero), `month` y `quarter` se derivan con los **mismos offsets** que `lib/services/progress-summary.ts` resuelve para sus ventanas del mismo nombre (semana = `today - weekdayIndex(today)` hasta `+6`; mes = `today-29` → `today`; trimestre = `today-89` → `today`). La equivalencia está **documentada** en el JSDoc del módulo, no importando constantes del otro: la intención es que Hábitos y Progreso no puedan divergir en qué significa "esta semana".

### A4. Honestidad de datos: actividad observada ≠ adherencia a una meta

Esta wave entrega **actividad observada**: en cuántos días hay algún registro y cuántos días transcurrieron. **No** hay meta, objetivo ni porcentaje de cumplimiento, y **ningún** número se divide por un target almacenado. La etiqueta "Hábitos & Adherence" del release **no** significa adherencia a una meta: significa actividad registrada y legible. El umbral `INSIGHT_MINIMUM_ELAPSED_DAYS = 7` de `types/habit-activity.ts` es una decisión de **presentación** ("todavía no hay suficiente período para resumir"), no un ajuste de los conteos: los conteos son siempre veraces y el estado del insight es solo advisory.

### A5. Reconciliaciones verificadas contra el brief

- La card **"Hábitos consistentes" se eliminó** de `components/progress/ProgressInsightCards.tsx`, y ese archivo **encogió** (239 → 202 líneas): su estado vacío presentaba como medición algo que no se calculaba.
- `habits.todayOnly` **se reescribió, no se borró** (commit `c90de22`): la frase pasó de `Hoy registraste {done} de {total} hábitos; eso no se muestra como porcentaje histórico.` a nombrar el detalle día por día que está justo debajo. El símbolo se conservó; su único consumidor cambió de la card eliminada a `components/habits/HabitsScreen.tsx:93`.
- Se **agregó** el grupo de copy `habitActivity.*` en `lib/copy/progress.ts` (título, leyenda de días registrado / sin registro / todavía no llegó, etiquetas de período y estados de carga e indisponible).
- El fix de etiqueta de ventana de bienestar (**D6**) fue **de copy**: `lib/copy/progress.ts:58` agregó `wellbeing.windowLabel` ("Refleja solo tu check-in de hoy. No se acumula con el período elegido.") y `components/progress/ProgressInsightCards.tsx:164` reemplazó el literal `Basado en tu check-in registrado.` por ese símbolo. La composición de `app/dashboard/progress/page.tsx` **no** cambió para bienestar: el call site de `WellbeingCard` sigue recibiendo solo `checkin`/`loading`/`error`, y las ediciones de ese archivo en la misma wave fueron el reemplazo de `useHabits`/`HabitConsistencyCard` por `useHabitActivity`/`HabitActivityCard` (defecto #1).
- El registro de actividad vive en la pantalla de Hábitos y es **de solo lectura**: no crea, no edita ni borra hábitos, y no agrega navegación nueva.

### A6. Lo que sigue diferido

**"Streaks / nudges"** (fila 3 de la tabla de este ADR, **Must**) recibió **cero cambios** en esta wave: ya estaba entregado en waves anteriores — `lib/services/streaks.ts`, `app/api/cron/streak-nudge/route.ts`, `types/streak.ts` y la tabla `streakNudges` en `lib/db/schema.ts:506`. No es un pendiente de v0.9.0 ni una capacidad que falte: actividad registrada **no** es una racha, y nadie debería reimplementarla por leer este addendum.

Lo que sí queda sin cerrar en esta wave, con evidencia `archivo:línea` en [`docs/backlog/deferred-defects-2026-09.md`](../backlog/deferred-defects-2026-09.md): los botones de header de Progreso sin handler (`components/progress/ProgressHeader.tsx`, cero `onClick`) y el "Volumen no disponible" impreso incondicionalmente en las filas de sesiones recientes (`components/progress/RecentSessionsCard.tsx:57`). La prueba end-to-end de estas pantallas quedó cubierta por `e2e/habit-activity.spec.ts` (20 casos) en el PR #167.

### A7. Cierre del defecto #5: la promesa de actividad del row de Settings

El brief §3.1 registró como defecto que el row "Hábitos de bienestar" de Settings prometiera **actividad histórica** sin read path. Verificado en el código integrado: el destino de ese row, `app/dashboard/habits/page.tsx:21`, renderiza `<HabitActivityHistory />` — junto a `<HabitsScreen />` en `:20` —, que muestra la actividad del período elegido sobre la misma ventana de Córdoba que el resto del producto. La promesa del row (`app/dashboard/settings/page.tsx:279`, literal `description="Ver actividad y hábitos"`) queda por lo tanto **cumplida**, no diferida.

Lo que permanece no es una promesa rota sino una imprecisión de copy, y se registra como tal: el subcopy del row es un literal en el JSX mientras `lib/copy/ui.ts:23` define `profileHabitsDescription`, key que **no se usa en ningún archivo del repo** y cuyo texto además habla solo de "hoy"; y el subtítulo de la pantalla de Hábitos (`app/dashboard/habits/page.tsx:16-18`, "Tu registro manual de hoy") describe solo los controles de hoy aunque debajo esté el registro por período. Estado detallado: [`docs/backlog/deferred-defects-2026-09.md`](../backlog/deferred-defects-2026-09.md).
