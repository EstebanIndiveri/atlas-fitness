# Backlog — Atlas Fitness

Fuente de verdad de alcance junto a los ADRs en [`docs/architecture/`](../architecture/) y el harness de trabajo en [`AGENTS.md`](../../AGENTS.md).  
La última versión **publicada** es **v0.12.0 "Progression Foundation"** (release PR #215, merge commit `16bfea5b250b203c7d039e75857c3cbeb1a95e0d`, tag anotado `v0.12.0` objeto `e1cb8f04b5c780879cd27342ccb30369348c85ee` sobre ese commit, `package.json`/`package-lock.json` en **0.12.0**; migración aditiva `0025_workout_sets_semantics` con cero backfill, pre-merge run `36799816542` y post-merge run `36800194783`, ambas `SUCCESS`; deployment de producción id `6773788073` `SUCCESS`; smoke autenticado de producción run `36800289552` `PASS`). Evidencia: [`docs/operations/2026-10-01-v0.12.0-release-execution-evidence.md`](../operations/2026-10-01-v0.12.0-release-execution-evidence.md). Además, este backlog refleja `develop` tras los PR #163–#165, #167, la publicación de v0.9.0 y la publicación de la wave v0.10.0 (días objetivo de hábitos, workstreams A–F): el release PR #186 se fusionó en `main` mediante merge normal (no squash) en `531bf0706355763885c9798fc012a5eb6bbc0298`, el tag anotado `v0.10.0` (objeto `a03d0591f172f87a8b3410a2e003d614dba38a31`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en **0.10.0**. v0.7.0 se publicó con el tag sobre `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`. El PR de release #138 se fusionó en `main` como `ba0857c5c42f730263e2d735ff57e69f6b0d42ea` y #139 finalizó los metadatos en `e1a592cb1aa9d26205933e2301b9926b9b834aa0`, sobre cuyo commit se creó y publicó el tag anotado `v0.7.1`. Después se publicó **v0.8.0** con el tag anotado `v0.8.0` sobre `44c0bbfca8f52995f7a850b997118814e27b3043`. Luego se publicó **v0.9.0** con el tag anotado `v0.9.0` sobre `0cd7a1a250cbdbf81f4897af129274524222a206` (release PR #168; back-merge a `develop` en el PR #169), y después **v0.10.0** con el tag anotado `v0.10.0` sobre `531bf0706355763885c9798fc012a5eb6bbc0298` (release PR #186), dejando las versiones de paquete en **0.10.0**. Este repo publica mediante tag anotado, no mediante GitHub Releases. El CI de los cambios de producto v0.7.1 pasó en el run 36201073118. Este backlog convive con la visión estratégica de [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md): ese documento marca el norte de **Atlas Adaptive Core V1**; este README traduce el estado operativo y lo que queda. Para el checkpoint paso-a-paso y evidencia de pruebas ver [`handoff-2026-09.md`](./handoff-2026-09.md). Además, la wave **v0.11.0 "Memoria de ejercicio"** (workstreams A–F) **está publicada**: el release PR #197 (`chore(release): v0.11.0`, `release/0.11.0` → `main`, head `a8c9bc95aec95f5398a5de0cff4afcb91a83fc78`) se fusionó en `main` mediante merge normal (no squash) en `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e` (merge commit), el tag anotado `v0.11.0` (objeto `eb2aab85a7739b0caa454726f230784f2ae92424`, target pelado `27fe2a0`) apunta a ese commit y `package.json`/`package-lock.json` quedaron en **0.11.0**. v0.11.0 es la versión publicada **anterior** a v0.12.0. La verdad, la matriz claim→evidencia y el resultado de release (incluido el smoke autenticado de producción **ejecutado y PASS**, run `36747341881`) están en [`handoff-2026-09.md`](./handoff-2026-09.md) §6.

## Estado actual del producto

Atlas ya dejó atrás el scaffold: existe un loop usable de **onboarding → Hoy → Entrenar/adaptar → sesión guiada → feedback/progreso**, con PWA, auth, DB Turso/libSQL + Drizzle, Telegram link/webhook modular, rutinas, planes semanales, Coach Atlas y métricas con fuente.

### Hecho recientemente

- ✅ **Progression Foundation (v0.12.0, publicada el 2026-09-30)**: captura semántica explícita y versionada de la serie (`semantic_capture_version=1` con `load_mode`/`amount_basis`/`side`/`set_purpose`/`rep_count_basis`; migración aditiva `0025_workout_sets_semantics`, **cero backfill**, legacy raw/unknown), dominio puro de progresión (`lib/progression/**`), read model acotado `GET /api/exercises/[id]/progression` con PR externo estricto (primera sesión elegible = `baseline`, mayor estricto = `new_pr`, empate = `ties_best`; workout abierto nunca PR), escritores web/Telegram que exigen semántica completa, y retiro del PR legacy de peso desnudo (`GET /api/stats/prs` → `410 PR_CONTRACT_RETIRED`) y de las métricas mixtas de volumen/fuerza. Sin e1RM, sin PR de peso corporal/asistido/añadido/alternado, sin rankings/Body Map/motion/gamificación y sin recomendación automática de carga. **Publicada en v0.12.0** (release PR #215; merge commit `16bfea5b250b203c7d039e75857c3cbeb1a95e0d`; tag anotado `v0.12.0`, objeto `e1cb8f04b5c780879cd27342ccb30369348c85ee`, sobre ese commit). Evidencia de release en [`../operations/2026-10-01-v0.12.0-release-execution-evidence.md`](../operations/2026-10-01-v0.12.0-release-execution-evidence.md).
- ✅ **Memoria de ejercicio (v0.11.0, publicada el 2026-09-29)**: durante una sesión activa el usuario puede guardar una **nota explícita** por ejercicio, persistida con ownership `user/workout/exercise`, `version` monotónica y compare-and-swap `{noteId, version}` (inmutable tras cerrar el workout); al reaparecer el ejercicio, el player devuelve la nota y las **series previas como registros históricos raw** del mismo `exerciseId` (reps y `weightKg` decimal string), con fechas Córdoba independientes y sin inferir progresión, readiness, significado de dolor ni próxima carga. Tipos/validación pura (`types/exercise-session-memory.ts`, `lib/session/exercise-session-memory.ts`), migración aditiva `0024_workout_exercise_notes` con **cero backfill** (`lib/db/schema.ts`), servicios transaccionales y read model acotado (`lib/services/exercise-session-memory.ts`), rutas delgadas + parser total (`app/api/workouts/[id]/exercises/[exerciseId]/**`, `lib/api/exercise-session-memory.ts`), UI (`components/session/ExerciseNotePanel.tsx`, `components/session/LastCompletedPanel.tsx`, `hooks/useExerciseSessionMemory.ts`) y copy de feedback corregido (`lib/copy/session.ts`, sin promesa de recuperación/carga). Evidencia E2E en `e2e/exercise-session-memory.spec.ts` (8 casos). **Publicada en v0.11.0** (release PR #197; merge commit `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e`; tag anotado `v0.11.0`, objeto `eb2aab85a7739b0caa454726f230784f2ae92424`, sobre ese commit; `package.json`/`package-lock.json` en 0.11.0). Matriz claim→evidencia y resultado de release en [`handoff-2026-09.md`](./handoff-2026-09.md) §6.
- ✅ **Días objetivo de hábitos (v0.10.0, publicada el 2026-09-29)**: el usuario declara en qué días de la semana espera registrar cada hábito del catálogo fijo. Intención versionada con vigencia Córdoba y sin backfill (`lib/db/migrations/0023_habit_target_schedules.sql`, `lib/db/schema.ts`, `lib/services/habit-targets.ts`); create/update/deactivate explícitos con conflicto optimista `{ targetId, version }` (`409`), reemplazo del mismo día y cancelación transaccional sin borrar historia (`app/api/habit-targets/**`); cumplimiento `N de M días objetivo` con `configurationState`/`metricState` independientes y `no_expected_days` sin ratio (`lib/services/habit-target-adherence.ts`, `types/habit-adherence.ts`, `app/api/stats/habit-adherence/route.ts`, `components/progress/HabitTargetAdherenceCard.tsx`); configuración y read-back en Hábitos con señal "Objetivo de hoy" (`components/habits/**`, `components/today/TodayHabitsCard.tsx`, `hooks/useHabitTargets.ts`, `hooks/useHabitAdherence.ts`). La actividad v0.9 (`/api/stats/habits`) permanece observacional y sin cambios. Evidencia E2E en `e2e/habit-targets.spec.ts` (13 casos). **Publicada en v0.10.0** (release PR #186; tag anotado `v0.10.0` sobre `531bf07`).
- ✅ **Honestidad de Progreso (v0.10.0, publicada el 2026-09-29)**: se retiraron los botones inertes de `components/progress/ProgressHeader.tsx` y las sesiones recientes muestran el volumen real por sesión cuando existen sets elegibles, con "Volumen no disponible" solo cuando realmente falta (`lib/services/progress-summary.ts`, `components/progress/RecentSessionsCard.tsx`). Cierra los defectos #3/#4 de la wave v0.9.0; #5 ya estaba cerrado por el read path de actividad.

- ✅ **Actividad de hábitos registrada (v0.9.0, PR #163–#165 y #167; publicado con el tag anotado `v0.9.0` sobre `0cd7a1a` vía el release PR #168)**: dominio puro de actividad (`lib/services/habit-activity.ts`) con loader acotado en `lib/services/habit-logs.ts`; `GET /api/stats/habits` de solo lectura con cliente tipado (`lib/api/habit-activity.ts`); y lectura en pantalla — card en Progreso (`components/progress/HabitActivityCard.tsx`) y registro día por día con selector de período semana/mes/trimestre en hora de Córdoba en Hábitos (`components/habits/HabitActivityHistory.tsx`, montado en `app/dashboard/habits/page.tsx:21`). Se reporta **actividad observada** (días con registro sobre días transcurridos), sin metas ni porcentaje de cumplimiento, y la card "Hábitos consistentes" se eliminó por presentar un empty state como si fuera una medición. La prueba end-to-end de estas pantallas quedó cubierta por `e2e/habit-activity.spec.ts` (20 casos) en el PR #167. El input de actividad de hábitos al Coach y al brief del plan (workstream D) **no se construyó**.

- ✅ **Coach freeText / adaptación honesta**: la adaptación interpreta poco tiempo, fatiga y falta de máquinas, con motivos trazables y fallback determinístico.
- ✅ **`dayReason` honesto**: `lib/services/day-reason.ts` reemplaza leaks de notas libres por copy determinístico basado en check-in, descanso previo y objetivo del plan.
- ✅ **Plan semanal — crear y editar**: creación manual, `GET/PATCH /api/training-plan/[id]`, pantalla `/dashboard/plan/[id]/edit` y modo edit de `usePlanBuilder`.
- ✅ **Plan guiado**: wizard `/dashboard/plan/guided` genera un borrador sobre catálogo real; solo al confirmar crea el plan y sus rutinas por día, de forma atómica e idempotente.
- ✅ **v0.7.1 (PR #130–#137 integrados por el release PR #138)**: pantalla dedicada de Hábitos; hub del plan semanal activo y mejora con comparación/confirmación explícita; Perfil con datos guardados del servidor; inicio desde Hoy y reanudación de sesiones adaptadas con el check-in, ejercicios omitidos y objetivos reducidos persistidos; controles de ánimo sin overflow móvil. Los metadatos quedaron finalizados y `v0.7.1` se publicó con el tag anotado sobre `e1a592cb1aa9d26205933e2301b9926b9b834aa0`.
- ✅ **Mejora del plan semanal activo**: `/dashboard/plan/[id]/improve` parte del plan activo autenticado y de una intención explícita; presenta una comparación ANTES/PROPUESTA sin escrituras y solo reemplaza el plan tras confirmación explícita, de forma atómica e idempotente. Las rutinas previas no se mutan.
- ✅ **Coach Context (PR #118–#124, candidato v0.7.0)**: persistencia autenticada de `goal/pace/equipment` con distinción entre fila ausente y fila explícita con todos los valores `null`; Finish de onboarding sincroniza, Skip no sincroniza; importación legacy exige vista previa/confirmación y alta condicional. Perfil permite editar/guardar sin alterar el plan activo. El brief guiado lee contexto guardado como valores iniciales editables (`days-5` → `5`), sin generar ni guardar automáticamente. La generación autenticada muestra si el resultado vino de Gemini o del fallback, y solo persiste tras Guardar explícito con escritura atómica/idempotente.
- ✅ **Convergencia Figma**:
  - sesión guiada: Técnica/media, Notas, set table mobile y CTA fija;
  - Progreso: interpretación, fuerza, consistencia, bienestar, hábitos y sesiones;
  - detalle de rutina;
  - Onboarding 4 pasos;
  - Entrenar hub;
  - Perfil;
  - bottom nav con tabs/iconos/estado activo;
  - **Hoy home screen (released v0.6.0; regresiones de dispositivo corregidas en v0.6.1)**.
- ✅ **CTA “Crear con Coach Atlas”** en rutinas/plan para creación guiada.
- ✅ **Coach AI weekly-plan (v0.6.0)**: `lib/ai/weekly-plan-draft.ts` + `weekly-plan-prompt.ts` generan el plan semanal con Gemini cuando hay key y caen a un draft determinístico sobre catálogo real (timeout/error/JSON malformado/sin key), validando IDs y `dayOfWeek`.
- ✅ **Fixes UX player + Hoy (v0.6.1)**: CTA verde+check, timer de descanso siempre visible, "Añadir serie" funcional, contraste del ánimo (raíz `cn()` sin tailwind-merge), overflow de hábitos, hero+progress bar, equipamiento real en Perfil.
- ✅ **Estabilidad Playwright (PR #114, mergeado en `develop`)**: las esperas de respuesta/navegación se registran antes de las acciones; el E2E de RoutineEditor cubre `90 → vacío → 30`. Resultados completos en el handoff operativo; esto es evidencia de pruebas, no una función ni un cambio de producto.

## MoSCoW actualizado

### Must — cerrado o en cierre de release

- Auth register/login/logout/me + sesión HMAC revocable.
- DB Turso/libSQL + Drizzle con migraciones y seed local/QA.
- Catálogo de ejercicios/rutinas, ownership y soft delete.
- Workouts/sets, sesión activa, skip/hold/cola, cierre y feedback post-workout.
- Plan semanal V1, resolución de “hoy” en `America/Argentina/Cordoba`, estados sin plan/descanso/rutina faltante.
- Daily check-in ánimo + energía y hábitos manuales básicos.
- Hero de Hoy con motivo honesto y acciones Empezar/Adaptar.
- Coach adaptation preview/apply sobre rutinas/sesión con fallback.
- Progreso básico con consistencia semanal, fuerza y sesiones recientes.
- Actividad de hábitos registrada — lectura por período (`week`/`month`/`quarter` en `America/Argentina/Cordoba`), de solo lectura y con fuente declarada, sobre los días transcurridos. Publicada en v0.9.0 (tag anotado `v0.9.0` sobre `0cd7a1a`).
- Días objetivo de hábitos (v0.10.0) — intención explícita versionada por días de la semana, cumplimiento `N de M días objetivo` y honestidad de Progreso. **Publicada en v0.10.0** (release PR #186; tag anotado `v0.10.0` sobre `531bf07`; `package.json`/`package-lock.json` en 0.10.0).
- Memoria de ejercicio (v0.11.0) — nota explícita por ejercicio, versionada y con ownership, más read model acotado de series/nota previas del mismo `exerciseId`. **Publicada en v0.11.0** (release PR #197; merge commit `27fe2a04e716b814f4c10fbdb29b9a827cdaf39e`; tag anotado `v0.11.0` objeto `eb2aab85a7739b0caa454726f230784f2ae92424` sobre ese commit; `package.json`/`package-lock.json` en **0.11.0**). El smoke autenticado de producción se ejecutó y **PASÓ** (run `36747341881`, 2026-09-30; evidencia en [`../operations/2026-09-30-production-smoke-h5-execution-evidence.md`](../operations/2026-09-30-production-smoke-h5-execution-evidence.md)). No afirmar progresión/PR/e1RM/readiness/recomendación de carga/aprendizaje del Coach.
- PWA instalable + Settings/Profile con copy de instalación.
- Telegram link/webhook modular e idempotente.
- Data honesty por tipos (`Metric<T>`, `MetricValue`) y empty states honestos.

### Must — cerrado en release

- ✅ **coach-weekly-plan AI (v0.6.0)**: flujo guiado semanal con Gemini + fallback determinístico verificable sobre catálogo real; no bloquea si no hay `GEMINI_API_KEY`.
- ✅ **Hoy Figma convergence (v0.6.0/v0.6.1)**: released y con regresiones de dispositivo corregidas.

### Should — próximos candidatos

- **Input de actividad de hábitos al Coach y al brief del plan semanal (workstream D de v0.9.0, `Should`, fuera de la ruta crítica): no construido.** Quedó deliberadamente fuera del alcance de v0.9.0; su precondición —el read path histórico de actividad— ya existe. Si se prioriza, nunca debe presentarse al modelo como adherencia a una meta, sino como actividad observada.
- Si PO prioriza más explicabilidad, agregar una razón por día basada únicamente en el brief y el borrador observables. La revisión actual atribuye Gemini/fallback y muestra objetivo, día, foco y ejercicios con series/repeticiones; no presenta una explicación basada en historial, check-ins, biometría ni aprendizaje.
- Ampliar rate limiting durable a superficies adicionales sólo si el uso lo requiere; login/register ya tienen límite durable. No hay evidencia actual para considerar implementados límites de Telegram, Gemini o crons.
- Observabilidad más completa para endpoints sensibles si aumenta el uso real.
- Telegram Mini App consumiendo los mismos `/api/*` (ADR-002), si aporta más que la PWA instalada.

### Deferred / follow-up (perfil)

- **Notificaciones y recordatorios**: continúan diferidos; no hay pantalla ni acción real implementada.

Coach Context no implica aprendizaje automático ni modifica el plan activo al editar preferencias. Las preferencias solo se usan como valores iniciales del brief editable del plan guiado; generación, revisión y guardado siguen siendo pasos separados bajo control del usuario.

### UX gaps conocidos (pendientes de verificar/priorizar)

- **Defectos de honestidad de datos de Progreso (#3 y #4) — resueltos por v0.10.0 (publicado el 2026-09-29):** los botones sin acción de `components/progress/ProgressHeader.tsx` se retiraron y el volumen de sesión ya se muestra cuando existen sets elegibles, con "Volumen no disponible" solo cuando realmente falta (`lib/services/progress-summary.ts`, `components/progress/RecentSessionsCard.tsx`, `e2e/habit-targets.spec.ts`). El defecto **#5 ya estaba cerrado** por el read path histórico de actividad. [`deferred-defects-2026-09.md`](./deferred-defects-2026-09.md) conserva el registro `archivo:línea` y el estado verificado de la wave v0.9.0 como evidencia histórica.
- **Progreso de fuerza — validación QA pendiente, no bug confirmado:** código y tests sintéticos soportan que una sesión elegible se muestre como “Punto de partida”. La validación contra historial QA real todavía está pendiente; no marcar como resuelto ni como backlog stale.

### No reproducido / comportamiento verificado

- **Persistent Notice:** No reproducido. Reabrir sólo con pantalla/componente/trigger y comportamiento esperado concretos.
- **RoutineEditor descanso:** PR #114 valida el comportamiento `90 → vacío → 30` en E2E. La afirmación histórica de que el `0` no se podía borrar ya no describe el comportamiento cubierto.

### Could

- Periodización/mesociclos simples y sugerencias de progresión.
- Más gráficos de progreso por ejercicio/grupo muscular.
- Hábitos avanzados y recordatorios configurables.
- Rutinas IA más expresivas, siempre con catálogo real y fallback.

### Won't / fuera de alcance V1

- Wearables, HealthKit/Health Connect, biometría automática, HRV, sueño automático o recovery score.
- Dieta completa, calorías/macros como producto central.
- Marketplace de gimnasios, multi-tenant de grupos, social feed completo.
- Offline sync de entrenos en gimnasio.
- App nativa Swift-only; Expo queda post-PMF según ADR-002.

## Riesgos y bloqueos conocidos

- **Branch protection**: sigue bloqueado si no hay permisos de repo admin. No resolver desde código; requiere dueño del repo.
- **IA semanal**: riesgo de prometer más de lo que el código hace. Toda respuesta debe validar IDs del catálogo y caer a fallback determinístico.
- **Concurrencia de agentes**: mantener ownership de paths. Un solo writer hace git/PR; subagentes solo en archivos disjuntos.
- **Data honesty**: cualquier métrica nueva necesita fuente explícita o empty state; no agregar “scores” o biometría demo.

## Orden sugerido de entrega

1. Si QA lo requiere, validar progreso de fuerza con historial QA real; no convertir la falta de esa evidencia en bug confirmado.
2. Si PO prioriza, ampliar la explicación diaria del borrador sin atribuir señales o aprendizaje que el código no usa ni muestra.
3. Las notificaciones siguen diferidas hasta contar con una acción real.
4. Cada entrega: TDD → auditoría pre-PR con `code-review` → suite full limpia → PR a `develop` → release candidate desde `develop` → `main` + tag + back-merge.
5. La wave v0.10.0 (días objetivo de hábitos) se publicó por el flujo del punto 4: release PR #186 fusionado en `main` (merge commit `531bf07`) y tag anotado `v0.10.0` sobre ese commit. Los defectos #3 y #4 quedaron resueltos por esa wave (el #3 se resolvió retirando el botón inerte); el #5 ya estaba cerrado por el read path de actividad. [`deferred-defects-2026-09.md`](./deferred-defects-2026-09.md) conserva el registro histórico de la wave v0.9.0.

## Handoffs

- [`deferred-defects-2026-09.md`](./deferred-defects-2026-09.md) — registro histórico de los defectos de honestidad de datos de la wave v0.9.0 (#1 y #2 corregidos, #5 cerrado por el read path entregado, #3 y #4 luego resueltos y publicados en v0.10.0), con evidencia `archivo:línea` de su wave.
- [`handoff-2026-09.md`](./handoff-2026-09.md) — handoff operativo actual para personas/agentes: arquitectura, estado, backlog, guidelines y recomendaciones.
- [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md) — visión estratégica Atlas Adaptive Core V1: DATA HONESTY RULE, roadmap de dos tracks, MoSCoW original y DoD aspiracional.
