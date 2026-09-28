# Defectos diferidos de honestidad de datos — wave v0.9.0 (2026-09-27)

> **Registro durable de candidatos diferidos.** El brief de v0.9.0 (§3.1) listó **cinco** defectos de honestidad de datos. La wave corrigió **#1 y #2** (ver [`../../CHANGELOG.md`](../../CHANGELOG.md) bajo `[0.9.0]`) y, sin proponérselo como corrección, **cumplió la promesa de #5** al entregar el read path histórico que faltaba. Los **dos candidatos restantes (#3 y #4)** quedaron explícitamente *"logged as candidates, not silently absorbed into scope"*: este documento los deja por escrito con evidencia verificable para que no se evaporen.
>
> **Estado verificado contra el código integrado en `develop`** (base de esta wave, merge-base `40fc988`). **#3 y #4 siguen sin corregir en esa base; la promesa de #5 ya está cubierta.** Los archivos citados son **evidencia**, no superficie de edición: `lib/copy/ui.ts` y `components/progress/ProgressHeader.tsx` son código.
>
> **Cobertura de pruebas:** la prueba end-to-end de las pantallas de hábitos y Progreso quedó **pendiente del workstream de QA (E)**; en esta base no existe `e2e/habit-activity.spec.ts` y no se registran sus resultados.

## Cómo leer cada entrada

- **Estado:** verificado contra el código, no inferido del brief.
- **Evidencia:** `archivo:línea` abrible que hace verdadera la afirmación.
- **Qué haría falta:** el cambio mínimo que cerraría el defecto — descripto, **no** implementado acá.

---

## #1 y #2 — cerrados en v0.9.0 (referencia)

| # | Defecto | Estado | Cómo quedó |
|---|---|---|---|
| 1 | Card "Hábitos consistentes" presentaba un empty state como si fuera una medición, sin historial real detrás. | **Cerrado** | La card se eliminó de `components/progress/ProgressInsightCards.tsx` (que encogió de 239 a 202 líneas) y la actividad observada real se lee en el registro por día. |
| 2 | Card "Bienestar registrado" mostraba datos solo-de-hoy bajo las pestañas de mes y trimestre. | **Cerrado** | `lib/copy/progress.ts:58` (`wellbeing.windowLabel`) declara que refleja el check-in de hoy y no se acumula con el período elegido; se renderiza en `components/progress/ProgressInsightCards.tsx` (`WellbeingCard`). |

---

## #3 — Botones de header de Progreso sin handler

- **Estado:** **ABIERTO** en `40fc988`.
- **Qué se ve:** la cabecera de Progreso muestra dos acciones —"Notificaciones" y "Compartir progreso"— que son botones reales para el usuario y para la accesibilidad, pero **no hacen nada**: no hay `onClick`, ni `href`, ni estado `disabled`.
- **Evidencia:**
  - `components/progress/ProgressHeader.tsx:32-38` — `<button type="button" aria-label="Notificaciones">`.
  - `components/progress/ProgressHeader.tsx:39-45` — `<button type="button" aria-label="Compartir progreso">`.
  - `grep -c onClick components/progress/ProgressHeader.tsx` → **0**.
- **Por qué es un defecto de honestidad:** un control habilitado promete una acción. Acá la promesa es visual: el usuario toca y no pasa nada. La regla del proyecto (§3 del handoff operativo) es que nada visible se muestre sin fuente o acción reales.
- **Qué haría falta:** o implementar ambas acciones (compartir tiene requisitos de producto y de plataforma; notificaciones choca con el item diferido de notificaciones), o retirarlas/deshabilitarlas hasta que existan. Se relaciona con el item diferido **"Notificaciones y recordatorios"** de `docs/backlog/README.md`, que sigue sin pantalla ni acción real.
- **No cubierto por tests:** no hay test que afirme que estos botones producen un efecto — coherente con que no lo produzcan.

## #4 — Filas de sesiones recientes siempre dicen "Volumen no disponible"

- **Estado:** **ABIERTO** en `40fc988`.
- **Qué se ve:** cada fila de "Sesiones recientes" imprime el copy de indisponible, **incondicionalmente**, aunque el volumen de esa sesión sí se computa en la misma pantalla.
- **Evidencia:**
  - `components/progress/RecentSessionsCard.tsx:56-58` — imprime `PROGRESS_COPY.sessions.volumeUnavailable` sin ninguna condición ni valor.
  - `lib/copy/progress.ts:102` — `volumeUnavailable: 'Volumen no disponible'` (esa es la línea real en `40fc988`).
  - `components/progress/RecentSessionsCard.test.tsx:27` — `expect(screen.getByText('Volumen no disponible')).toBeTruthy()`: el test **fija** el comportamiento actual en lugar de detectarlo como carencia.
  - El volumen por sesión **sí** se calcula: `lib/services/strength-progress.ts:212` (`totalVolumeKg: sumVolumeKg(workout.sets)`, decimal string) y se tipa en `lib/services/strength-progress.ts:13-17` (`StrengthVolumePoint.totalVolumeKg: string`).
  - El resumen que alimenta la card **no transporta** volumen: `lib/services/progress-summary.ts:16-21` (`ProgressSessionSummary` tiene `workoutId`, `startedAt`, `durationMinutes`, `routineName`).
- **Por qué es un defecto de honestidad:** el mensaje es correcto para el dato que la card *tiene*, pero es engañoso como descripción del sistema — el número existe en la misma pantalla. La duración de la misma fila sí se muestra con fuente (`RecentSessionsCard.tsx:60-70`, `metric(..., 'atlas_computed')`), lo que hace más visible la asimetría.
- **Qué haría falta:** propagar el volumen por sesión hasta `ProgressSessionSummary` y renderizarlo con `MetricValue`/`atlas_computed` (respetando el decimal string, nunca `number` float); conservar el copy de indisponible solo para el caso en que realmente falte. Ojo: el conjunto de sesiones de `strength-progress` y el de `progress-summary` no son necesariamente el mismo, así que el cierre requiere alinear ambos antes de mostrar el número.
- **No cubierto como defecto:** el test actual lo afirma como comportamiento esperado, así que un cierre tiene que **reescribir** esa aserción, no solo agregar cobertura.

## #5 — El row de Settings prometía actividad histórica (cerrado)

- **Estado:** **CERRADO por v0.9.0** — la promesa dejó de ser falsa porque existe un read path histórico verificable. Verificado en `40fc988`, no inferido del brief.
- **Qué decía el defecto:** en Settings, el row "Hábitos de bienestar" tiene la descripción "Ver actividad y hábitos" y lleva a `/dashboard/habits`; esa promesa de **actividad** histórica no tenía ningún read path (la pantalla mostraba solo el registro de hoy).
- **Evidencia (lo que promete):**
  - `app/dashboard/settings/page.tsx:279` — `description="Ver actividad y hábitos"` (literal en el JSX).
  - `app/dashboard/settings/page.tsx:278` — `title={UI_COPY.profileHabitsTitle}`.
  - `lib/copy/ui.ts:22` — `profileHabitsTitle: 'Hábitos de bienestar'`.
- **Evidencia (lo que ahora existe, y por eso se cierra):** el destino del row muestra actividad histórica de solo lectura:
  - `app/dashboard/habits/page.tsx:21` — `<HabitActivityHistory />`, junto a `<HabitsScreen />` en la línea `:20`.
  - `components/habits/HabitActivityHistory.tsx` — selector de período semana/mes/trimestre sobre la misma ventana de Córdoba que el resto del producto.
  - El mismo read path se expone además en Progreso (`components/progress/HabitActivityCard.tsx`), así que la actividad del período no depende de una sola pantalla.
- **Conclusión registrada:** **la promesa está cumplida**: quien siga ese row llega a actividad del período, no solo al registro de hoy. El brief la había listado como defecto de *read path faltante*; ese read path es exactamente lo que entregó v0.9.0.
- **Residual (copy, no promesa rota):** el subcopy del row es un literal en el JSX (`:279`) mientras `lib/copy/ui.ts:23` define `profileHabitsDescription` — `'Registrá check-ins y seguí tus hábitos de hoy.'` —, key que **no se usa en ningún archivo del repo** (su única aparición es su propia definición, sin consumidores ni tests) y cuyo texto habla solo de "hoy", por eso no sirve tal cual como reemplazo. Además, el subtítulo de la pantalla de Hábitos (`app/dashboard/habits/page.tsx:16-18`) se describe como "Tu registro manual de hoy" aunque debajo esté el registro por período.
- **Qué haría falta:** decidir si `profileHabitsDescription` se usa (reescribiéndola para nombrar el período) o se retira, y alinear el subtítulo de la pantalla con el contenido que ya muestra. Es una pasada de copy, no una funcionalidad faltante.
- **Nota de alcance:** esto **no** es una carencia de v0.9.0 ni un candidato abierto: la promesa quedó cubierta por el read path entregado. Lo residual es cosmético y queda registrado, no declarado como bug.

---

## Handoff

- Este archivo es el registro durable de los candidatos diferidos de la wave v0.9.0. Índice del backlog y estado operativo: [`README.md`](./README.md).
- Checkpoint operativo paso a paso: [`handoff-2026-09.md`](./handoff-2026-09.md).
- Reconciliaciones de arquitectura de esta wave (colocación del loader, regla de una sola consulta acotada, actividad observada ≠ adherencia): [`../architecture/ADR-001b-habit-motivation.md`](../architecture/ADR-001b-habit-motivation.md), addendum v0.9.0.
