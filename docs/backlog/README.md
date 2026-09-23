# Backlog — Atlas Fitness

Fuente de verdad de alcance junto a los ADRs en [`docs/architecture/`](../architecture/) y el harness de trabajo en [`AGENTS.md`](../../AGENTS.md).  
Este backlog refleja el estado **posterior a v0.6.1** y convive con la visión estratégica de [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md): ese documento marca el norte de **Atlas Adaptive Core V1**; este README traduce el estado operativo y lo que queda. Para el checkpoint paso-a-paso ver [`handoff-2026-09.md`](./handoff-2026-09.md).

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
  - **Hoy home screen (released v0.6.0; regresiones de dispositivo corregidas en v0.6.1)**.
- ✅ **CTA “Crear con Coach Atlas”** en rutinas/plan para creación guiada.
- ✅ **Coach AI weekly-plan (v0.6.0)**: `lib/ai/weekly-plan-draft.ts` + `weekly-plan-prompt.ts` generan el plan semanal con Gemini cuando hay key y caen a un draft determinístico sobre catálogo real (timeout/error/JSON malformado/sin key), validando IDs y `dayOfWeek`.
- ✅ **Fixes UX player + Hoy (v0.6.1)**: CTA verde+check, timer de descanso siempre visible, "Añadir serie" funcional, contraste del ánimo (raíz `cn()` sin tailwind-merge), overflow de hábitos, hero+progress bar, equipamiento real en Perfil.

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

- Mejorar la explicación de Coach Atlas en creación semanal: mostrar claramente qué vino de IA (`source: 'gemini'`) vs fallback y por qué cada día quedó asignado.
- Endurecer UX de errores en creación guiada cuando falla una rutina intermedia o falla la limpieza compensatoria.
- Playwright Must end-to-end completo del golden path (la UI ya está estable).
- Rate-limit durable y observabilidad más completa para endpoints sensibles si aumenta uso real.
- Telegram Mini App consumiendo los mismos `/api/*` (ADR-002), si aporta más que la PWA instalada.

### Deferred / follow-up (perfil)

- **Preferencias de Coach** y **Notificaciones y recordatorios**: filas removidas de "Mi Atlas" en v0.6.1; reintroducir solo cuando existan pantallas/acciones reales.
- Pantalla dedicada para editar **Equipamiento/Objetivos** desde Perfil, sin obligar a rehacer el flujo guiado (hoy Equipamiento muestra el valor real del onboarding y enlaza al plan builder).
- **Pantalla de Hábitos de bienestar** dedicada (hoy la fila enlaza a Hoy, donde viven los hábitos).
- **Tour de onboarding** que exponga `goal/pace/equipment` a Coach Atlas para generación de plan con más contexto trazable, y permita al usuario contrastarlo/editarlo.

### UX gaps conocidos (pendientes de verificar/priorizar)

- **Alerta superior vs modal**: quitar el recuadro superior persistente por página y dejar solo el toast transitorio, extendiendo su duración a ~5–10 s.
- **Editar descanso entre series**: al borrar el default (p. ej. 90) queda un `0` no borrable en el editor de rutina; revisar el input numérico.
- **Progreso de fuerza**: validar punto de partida real con sesiones ya registradas por QA, sin inventar valores.

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

1. Revalidar el golden path en dispositivo real + Playwright Must (onboarding → today → start/adapt → guided session → post-workout → progress).
2. Cerrar los **UX gaps conocidos** (alerta vs modal, `0` no borrable en descanso, punto de partida de fuerza).
3. Explicabilidad del plan semanal (IA vs fallback) y tour de onboarding que alimente a Coach.
4. Editores dedicados de Perfil (Equipamiento/Objetivos) y pantalla de Hábitos si PO prioriza.
5. Cada entrega: TDD → auditoría pre-PR con `code-review` → suite full limpia → PR a `develop` → release candidate desde `develop` → `main` + tag + back-merge.

## Handoffs

- [`handoff-2026-09.md`](./handoff-2026-09.md) — handoff operativo actual para personas/agentes: arquitectura, estado, backlog, guidelines y recomendaciones.
- [`handoff-atlas-adaptive-core.md`](./handoff-atlas-adaptive-core.md) — visión estratégica Atlas Adaptive Core V1: DATA HONESTY RULE, roadmap de dos tracks, MoSCoW original y DoD aspiracional.
