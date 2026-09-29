# Atlas Fitness

Asistente de fitness personal para registrar entrenamientos, pesos, consejos, media de ejercicios y motivación — vía **web app** y **bot de Telegram** (misma lógica de producto que Hermes Finance: un dominio, dos canales).

> **Estado del repo (snapshot 2026-09-29):** la última versión **publicada** es **v0.10.0 "Días objetivo de hábitos"**, con el tag anotado `v0.10.0` (objeto `a03d0591f172f87a8b3410a2e003d614dba38a31`) sobre `531bf0706355763885c9798fc012a5eb6bbc0298` (release PR #186 fusionado en `main` con merge normal, no squash) y `package.json` / `package-lock.json` en 0.10.0. Entrega la intención explícita por días objetivo de hábitos (versionada, con vigencia Córdoba y sin backfill), el cumplimiento `N de M días objetivo` con la actividad v0.9 (`/api/stats/habits`) aún observacional y sin cambios, y la honestidad de Progreso. La publicación anterior es **v0.9.0 "Hábitos & Adherence"**, con el tag anotado `v0.9.0` sobre `0cd7a1a250cbdbf81f4897af129274524222a206` (release PR #168; actividad de hábitos registrada, PR #163–#165 y #167). El snapshot histórico de v0.8.0 sigue registrado con el tag anotado `v0.8.0` sobre `44c0bbfca8f52995f7a850b997118814e27b3043`, y el de v0.7.1 con el tag anotado `v0.7.1` sobre `e1a592cb1aa9d26205933e2301b9926b9b834aa0`. Este repo publica mediante tag anotado, no mediante GitHub Releases (no se creó un objeto GitHub Release). Ver [`docs/backlog/handoff-2026-09.md`](./docs/backlog/handoff-2026-09.md) para CI y smoke de producción.

## Visión (borrador)

- Registrar que fuiste a entrenar y qué pesos manejaste
- Biblioteca de ejercicios con explicaciones, imágenes y videos
- Asistente de IA (consejos, mejores prácticas, ánimo)
- Notificaciones, recordatorios y tips diarios
- Notas, estados de ánimo y motivación para sostener el hábito
- 100% usable para entrenamientos reales desde el día 1 del MVP

## Stack Técnico

- **Framework:** Next.js 16 App Router + React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Testing:** Jest (unit) + Playwright (e2e)
- **CI/CD:** GitHub Actions
- **PWA:** Manifest + iconos PNG 192/512 (any + maskable), service worker de shell estático, prompt de instalación
- **Database:** Turso/libSQL + Drizzle
- **Channels:** Web App/PWA + Telegram Bot

## Desarrollo Local

Guía completa (smoke sin red: file DB, seed, curl de cron/webhook stub; **integraciones reales opcionales**: Turso cloud, bot Telegram, IA no cableada): **[`docs/engineering/local-dev.md`](./docs/engineering/local-dev.md)**.

### Pre-requisitos

- Node.js 20+
- npm (incluido con Node)

### Setup

```bash
# Clonar el repositorio
git clone https://github.com/EstebanIndiveri/atlas-fitness.git
cd atlas-fitness

# Instalar dependencias, .env, migraciones y seed (usuario qa@atlas.test)
npm install
npm run setup:local

# Ejecutar en desarrollo
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

### PWA (instalable)

Atlas es una PWA Must: manifest, iconos reales, service worker de **shell estático** (no sync offline de entrenos).

```bash
npm run build
npm start
```

- Chrome (escritorio o Android, HTTPS o localhost): si el navegador dispara `beforeinstallprompt`, aparece el banner **Instalar**.
- iOS Safari: no hay prompt nativo. En Home y en **Ajustes** está el copy **Agregar a Inicio** (Home Screen).
- El service worker precachea `/`, iconos, manifest y `offline.html`. **No** intercepta `/api/*` (cookies de sesión y workouts siguen yendo a la red).

#### Playwright / CI

`beforeinstallprompt` **no se dispara en Chromium headless**. El e2e `e2e/pwa.spec.ts` omite ese flujo a propósito (`test.skip`) y documenta la verificación manual. CI sí cubre: link del manifest, campos clave, iconos PNG, copy iOS en Home y Ajustes, y que `sw.js` no cachea la API.


### Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo (con Turbopack)
npm run setup:local  # Copiar .env si falta + migrate + seed QA solo con file: DB
npm run db:migrate   # Aplicar migraciones Drizzle
npm run db:seed      # system data only
npm run db:seed:qa   # system data + known QA account; local/CI only
npm run db:verify    # required-table readiness check
npm run db:bootstrap:remote
npm run build        # Build de producción
npm start            # Iniciar servidor de producción

# Testing
npm test             # Ejecutar tests unitarios (Jest)
npm run test:watch   # Jest en modo watch
npm run test:e2e     # Ejecutar tests e2e (Playwright)

# Calidad de código
npm run lint         # Ejecutar ESLint
npm run typecheck    # Verificar tipos TypeScript (tsc --noEmit)
```

### Primera vez con Playwright

```bash
# Instalar navegadores de Playwright
npx playwright install chromium
```

## Estructura del Proyecto

```
atlas-fitness/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Layout raíz
│   ├── page.tsx           # Página principal
│   └── globals.css        # Estilos globales
├── components/            # Componentes React reutilizables
├── lib/                   # Lógica de negocio y servicios
│   ├── db/               # Database schema, client, migrations y readiness
│   ├── services/         # Application services / dominio
│   ├── telegram/         # Telegram bot handlers modulares
│   ├── ai/               # Gemini adapters + fallbacks determinísticos
│   └── format/           # Formatters (weight, date, etc.)
├── hooks/                 # React hooks personalizados
├── types/                 # TypeScript types compartidos
├── e2e/                   # Tests Playwright
├── docs/                  # Documentación
│   ├── architecture/     # ADRs
│   ├── backlog/          # Product backlog
│   └── engineering/      # Convenciones técnicas
├── public/                # Assets estáticos + PWA manifest
└── .github/workflows/     # GitHub Actions CI

```

Ver [`AGENTS.md`](./AGENTS.md) para convenciones de estructura y organización.

## CI/CD

### GitHub Actions

El pipeline de CI se ejecuta automáticamente en todos los PRs a `develop`:

1. **Lint** — ESLint para code quality
2. **Typecheck** — TypeScript strict mode
3. **Unit Tests** — Jest con cobertura
4. **E2E Tests** — Playwright smoke tests
5. **Build** — Verificar que la app construye correctamente

Estado del CI: `.github/workflows/ci.yml`

### Branch Protection

- ⚠️ **No push directo a `main` o `develop`**
- ✅ Pull Requests obligatorios con CI verde
- ✅ Code review requerido (mínimo 1 aprobación)
- ✅ Arquitectura aprueba cambios estructurales

Ver [`AGENTS.md`](./AGENTS.md) §3–5 para el branching model completo.

## Documentación

### Lectura Obligatoria (antes de implementar)

1. **[`AGENTS.md`](./AGENTS.md)** — Harness para agentes y humanos: roles, branching, TDD, PR flow
2. **[`docs/architecture/`](./docs/architecture/)** — ADRs con decisiones técnicas
   - ADR-001: System stack
   - ADR-002: Client channels (PWA + Telegram)
3. **[`docs/engineering/`](./docs/engineering/)** — Convenciones FE/BE/QA
   - `conventions-fe.md` — Frontend patterns
   - `conventions-be.md` — Backend patterns
   - `conventions-qa.md` — Testing & QA

### Convenciones Clave

- **TDD obligatorio:** Tests primero, implementación después
- **TypeScript strict:** No `any` injustificado
- **Pesos:** `weight_kg` como decimal string (no floats)
- **Timezone:** `America/Argentina/Cordoba`
- **i18n:** Copy en español (`es-AR`), código en inglés
- **Archivos:** Max ~200-250 líneas; extraer componentes/hooks

## Repo

- **Owner:** [EstebanIndiveri](https://github.com/EstebanIndiveri)
- **Producto hermano:** [hermes-finantial-tracker](https://github.com/EstebanIndiveri/hermes-finantial-tracker)

## Estado Actual (snapshot 2026-09-29)

v0.7.0 (tag `v0.7.0`, commit `dae2bc949538f9cb9fa02faf8db0712d04b9d9f9`) fue la versión publicada anterior a v0.7.1. El PR #138 integró en `main` los cambios v0.7.1: la pantalla dedicada de Hábitos, el hub y la mejora confirmada del plan semanal activo, persistencia de sesiones adaptadas y datos reales de Perfil. La publicación se completó con el tag anotado `v0.7.1` sobre `e1a592cb1aa9d26205933e2301b9926b9b834aa0`. Después se publicó **v0.8.0**, con el tag anotado sobre `44c0bbfca8f52995f7a850b997118814e27b3043`. Sobre esa base se publicó **v0.9.0 “Hábitos & Adherence”**: el release PR #168 se fusionó en `main` y el tag anotado `v0.9.0` apunta a `0cd7a1a250cbdbf81f4897af129274524222a206`, con el back-merge a `develop` completado en el PR #169. El incremento es el dominio de actividad de hábitos, su API de solo lectura (PR #163–#165) y su lectura en pantalla, cubierta end-to-end por `e2e/habit-activity.spec.ts` (20 casos) en el PR #167. Después se publicó **v0.10.0 “Días objetivo de hábitos”**: el release PR #186 se fusionó en `main` mediante merge normal (no squash) en `531bf0706355763885c9798fc012a5eb6bbc0298` y el tag anotado `v0.10.0` apunta a ese commit, con `package.json`/`package-lock.json` en 0.10.0.

✅ **Completado / usable:**
- Auth + sesiones HMAC revocables, link Telegram y webhooks modulares
- Turso/libSQL + Drizzle con migraciones, seed local/QA y ownership de catálogo
- PWA instalable con manifest, service worker de shell y prompts iOS/Chrome
- Onboarding de 4 pasos; al terminar sincroniza `goal`, `pace` y `equipment` con el perfil autenticado (una respuesta 401 conserva las respuestas locales). Omitir no sincroniza.
- Coach Context en Perfil: preferencias persistidas y editables; valores explícitos no modifican el plan activo. Respuestas antiguas del navegador solo se importan tras vista previa y confirmación, y nunca sobre una fila existente.
- Hoy con check-in ánimo/energía, hero de entrenamiento, motivo honesto y acciones Empezar/Adaptar (convergencia Figma released en v0.6.0, regresiones de dispositivo corregidas en v0.6.1)
- Plan semanal manual + edición (`/dashboard/plan/[id]/edit`)
- Hub del plan semanal activo, mejora con propuesta y confirmación explícita, y persistencia al reanudar entrenamientos adaptados (incluido en v0.7.1, publicado)
- Pantalla dedicada de Hábitos y Perfil basado en datos guardados del servidor (incluido en v0.7.1, publicado)
- Plan guiado “Crear con Coach Atlas” sobre catálogo real; guardar crea el plan y sus rutinas de forma explícita, atómica e idempotente
- Coach AI weekly-plan: el brief del plan guiado precarga las preferencias guardadas como campos editables; generar solo devuelve un borrador. La revisión identifica Gemini o fallback y muestra el objetivo, los focos y ejercicios/series/repeticiones propuestos; guardar es explícito, atómico e idempotente.
- Entrenar hub, rutinas, detalle de rutina y sesión guiada responsive (player pulido en v0.6.1: CTA verde+check, timer de descanso siempre visible, "Añadir serie")
- Coach adaptation con preview/apply, freeText y fallback determinístico
- Post-workout feedback y Progreso con métricas honestas (consistencia, fuerza, bienestar, sesiones y, desde v0.9.0, actividad de hábitos **registrada**: días con registro, no un porcentaje de cumplimiento)
- Actividad de hábitos registrada y legible (v0.9.0, publicada): registro de solo lectura con ventana de semana/mes/trimestre en hora de Córdoba en la pantalla de Hábitos, y su card en Progreso con la fuente declarada de cada número
- Días objetivo de hábitos (v0.10.0, publicada): intención explícita versionada por días de la semana con vigencia Córdoba y sin backfill, cumplimiento `N de M días objetivo` con `configurationState`/`metricState` independientes, y honestidad de Progreso (botones inertes retirados y volumen real por sesión). La actividad de hábitos (`/api/stats/habits`) sigue siendo observacional y el Coach no aprende de estos datos; no hay reminders
- Perfil/Settings y bottom nav con tabs, iconos y estados activos

🔜 **Backlog / diferido:** ver [`docs/backlog/README.md`](./docs/backlog/README.md) y el checkpoint paso-a-paso en el handoff.

📚 **Handoff actual:** [`docs/backlog/handoff-2026-09.md`](./docs/backlog/handoff-2026-09.md)  
📝 **Cambios por versión:** [`CHANGELOG.md`](./CHANGELOG.md)

Stack y alcance: ver [`docs/architecture/ADR-001-system-stack.md`](./docs/architecture/ADR-001-system-stack.md).

Implementación solo tras brief PO + respeto al harness ([`AGENTS.md`](./AGENTS.md)).

---

Hecho para [Esteban Indiveri](https://github.com/EstebanIndiveri).
