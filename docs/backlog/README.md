# Backlog — Atlas Fitness

Fuente de verdad de alcance junto a los ADRs en [`docs/architecture/`](../architecture/) y el harness de trabajo en [`AGENTS.md`](../../AGENTS.md).  
Este backlog refleja el estado posterior a v0.3.1 → v0.5.0 y convive con la visión estratégica de [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md): ese documento marca el norte de **Atlas Adaptive Core V1**; este README traduce el estado operativo y lo que queda.

## Estado actual del producto

Atlas ya dejó atrás el scaffold: existe un loop usable de **onboarding → Hoy → Entrenar/adaptar → sesión guiada → feedback/progreso**, con PWA, auth, DB Turso/libSQL + Drizzle, Telegram link/webhook modular, rutinas, planes semanales, Coach Atlas y métricas con fuente.

### Hecho recientemente

- ✅ **Coach freeText / adaptación honesta**: la adaptación interpreta poco tiempo, fatiga y falta de máquinas, con motivos trazables y fallback determinístico.
- ✅ **`dayReason` honesto**: `lib/services/day-reason.ts` reemplaza leaks de notas libres por copy determinístico basado en check-in, descanso previo y objetivo del plan.
- ✅ **Plan semanal — crear y editar**: creación manual, `GET/PATCH /api/training-plan/[id]`, pantalla `/dashboard/plan/[id]/edit` y modo edit de `usePlanBuilder`.
- ✅ **Plan guiado**: wizard `/dashboard/plan/guided` genera draft sobre catálogo real, crea rutinas por día, guarda plan y limpia rutinas si falla el plan.
- ✅ **Convergencia Figma**:
  - sesión guiada: Técnica/media, Notas, set table mobile y CTA fija;
  - Progreso: interpretación, fuerza, consistencia, bienestar, hábitos y sesiones;
  - detalle de rutina;
  - Onboarding 4 pasos;
  - Entrenar hub;
  - Perfil;
  - bottom nav con tabs/iconos/estado activo;
  - Hoy home screen en esta wave (rama actual, Unreleased hasta merge/release).
- ✅ **CTA “Crear con Coach Atlas”** en rutinas/plan para creación guiada.

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

### Must — en progreso

- 🚧 **coach-weekly-plan AI**: el flujo guiado semanal existe y genera draft determinístico sobre catálogo real. Falta completar/validar el cableado Gemini semanal directo manteniendo fallback determinístico, validación estricta y cero bloqueo si no hay `GEMINI_API_KEY`.
- 🚧 **Hoy Figma convergence**: componentes `components/today/**` están en la wave actual. Tratar como Unreleased hasta que se mergee/releasee.

### Should — próximos candidatos

- Mejorar la explicación de Coach Atlas en creación semanal: mostrar claramente qué vino de IA vs fallback y por qué cada día quedó asignado.
- Endurecer UX de errores en creación guiada cuando falla una rutina intermedia o falla la limpieza compensatoria.
- Playwright Must end-to-end completo del golden path cuando el producto se estabilice visualmente.
- Rate-limit durable y observabilidad más completa para endpoints sensibles si aumenta uso real.
- Telegram Mini App consumiendo los mismos `/api/*` (ADR-002), si aporta más que la PWA instalada.

### Deferred / follow-up (perfil)

- **Preferencias de Coach** y **Notificaciones y recordatorios** quedan intencionalmente diferidos; las filas de Perfil se remueven hasta que existan pantallas/acciones reales.
- Pantalla dedicada para editar **Equipamiento/Objetivos** desde Perfil, sin duplicar el flujo guiado actual.
- Tour de onboarding que alimente a Coach Atlas para generación de plan con más contexto trazable.

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

1. Cerrar wave Unreleased: Hoy Figma convergence + coach-weekly-plan AI con fallback.
2. Revalidar golden path manual/Playwright: onboarding → today → start/adapt → guided session → post-workout → progress.
3. Auditoría pre-PR completa con agente code-review y suite full limpia.
4. Cortar release candidate desde `develop` cuando branch protection/CI estén alineados.
5. Recién después explorar Should: explicabilidad del plan semanal, Mini App o progresión avanzada.

## Handoffs

- [`handoff-2026-09.md`](./handoff-2026-09.md) — handoff operativo actual para personas/agentes: arquitectura, estado, backlog, guidelines y recomendaciones.
- [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md) — visión estratégica Atlas Adaptive Core V1: DATA HONESTY RULE, roadmap de dos tracks, MoSCoW original y DoD aspiracional.
