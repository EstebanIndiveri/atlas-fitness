# Backlog — Atlas Fitness

Fuente de verdad de alcance junto a los ADRs en [`docs/architecture/`](../architecture/) y el harness de trabajo en [`AGENTS.md`](../../AGENTS.md).  
Este backlog refleja `develop` tras los PR #130–#137. La última versión publicada es v0.7.0 (tag sobre `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`); el candidato v0.7.1 parte del merge QA #136 (`6996dd8463d2c4b2cf08c40f900639c9ea504eca`) y su CI post-merge pasó en el run 36201073118. El candidato aún no está publicado. Convive con la visión estratégica de [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md): ese documento marca el norte de **Atlas Adaptive Core V1**; este README traduce el estado operativo y lo que queda. Para el checkpoint paso-a-paso y evidencia de pruebas ver [`handoff-2026-09.md`](./handoff-2026-09.md).

## Estado actual del producto

Atlas ya dejó atrás el scaffold: existe un loop usable de **onboarding → Hoy → Entrenar/adaptar → sesión guiada → feedback/progreso**, con PWA, auth, DB Turso/libSQL + Drizzle, Telegram link/webhook modular, rutinas, planes semanales, Coach Atlas y métricas con fuente.

### Hecho recientemente

- ✅ **Coach freeText / adaptación honesta**: la adaptación interpreta poco tiempo, fatiga y falta de máquinas, con motivos trazables y fallback determinístico.
- ✅ **`dayReason` honesto**: `lib/services/day-reason.ts` reemplaza leaks de notas libres por copy determinístico basado en check-in, descanso previo y objetivo del plan.
- ✅ **Plan semanal — crear y editar**: creación manual, `GET/PATCH /api/training-plan/[id]`, pantalla `/dashboard/plan/[id]/edit` y modo edit de `usePlanBuilder`.
- ✅ **Plan guiado**: wizard `/dashboard/plan/guided` genera un borrador sobre catálogo real; solo al confirmar crea el plan y sus rutinas por día, de forma atómica e idempotente.
- ✅ **v0.7.1 candidato (PR #130–#137)**: pantalla dedicada de Hábitos; hub del plan semanal activo y mejora con comparación/confirmación explícita; Perfil con datos guardados del servidor; inicio desde Hoy y reanudación de sesiones adaptadas con el check-in, ejercicios omitidos y objetivos reducidos persistidos; controles de ánimo sin overflow móvil.
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
- PWA instalable + Settings/Profile con copy de instalación.
- Telegram link/webhook modular e idempotente.
- Data honesty por tipos (`Metric<T>`, `MetricValue`) y empty states honestos.

### Must — cerrado en release

- ✅ **coach-weekly-plan AI (v0.6.0)**: flujo guiado semanal con Gemini + fallback determinístico verificable sobre catálogo real; no bloquea si no hay `GEMINI_API_KEY`.
- ✅ **Hoy Figma convergence (v0.6.0/v0.6.1)**: released y con regresiones de dispositivo corregidas.

### Should — próximos candidatos

- Si PO prioriza más explicabilidad, agregar una razón por día basada únicamente en el brief y el borrador observables. La revisión actual atribuye Gemini/fallback y muestra objetivo, día, foco y ejercicios con series/repeticiones; no presenta una explicación basada en historial, check-ins, biometría ni aprendizaje.
- Ampliar rate limiting durable a superficies adicionales sólo si el uso lo requiere; login/register ya tienen límite durable. No hay evidencia actual para considerar implementados límites de Telegram, Gemini o crons.
- Observabilidad más completa para endpoints sensibles si aumenta el uso real.
- Telegram Mini App consumiendo los mismos `/api/*` (ADR-002), si aporta más que la PWA instalada.

### Deferred / follow-up (perfil)

- **Notificaciones y recordatorios**: continúan diferidos; no hay pantalla ni acción real implementada.

Coach Context no implica aprendizaje automático ni modifica el plan activo al editar preferencias. Las preferencias solo se usan como valores iniciales del brief editable del plan guiado; generación, revisión y guardado siguen siendo pasos separados bajo control del usuario.

### UX gaps conocidos (pendientes de verificar/priorizar)

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

## Handoffs

- [`handoff-2026-09.md`](./handoff-2026-09.md) — handoff operativo actual para personas/agentes: arquitectura, estado, backlog, guidelines y recomendaciones.
- [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md) — visión estratégica Atlas Adaptive Core V1: DATA HONESTY RULE, roadmap de dos tracks, MoSCoW original y DoD aspiracional.
