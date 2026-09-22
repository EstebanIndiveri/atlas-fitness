# Atlas Fitness

Asistente de fitness personal para registrar entrenamientos, pesos, consejos, media de ejercicios y motivación — vía **web app** y **bot de Telegram** (misma lógica de producto que Hermes Finance: un dominio, dos canales).

> Estado: **v0.5.0 + wave Unreleased** — MVP de hábito/adaptive core usable: onboarding, Hoy, planes, adaptar, sesión guiada, feedback/progreso, PWA y Telegram. En curso: convergencia final de Hoy y generación semanal con Coach Atlas/Gemini + fallback.

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

## Estado Actual (v0.5.0 + Unreleased)

✅ **Completado / usable:**
- Auth + sesiones HMAC revocables, link Telegram y webhooks modulares
- Turso/libSQL + Drizzle con migraciones, seed local/QA y ownership de catálogo
- PWA instalable con manifest, service worker de shell y prompts iOS/Chrome
- Onboarding Figma-aligned de 4 pasos
- Hoy con check-in ánimo/energía, hero de entrenamiento, motivo honesto y acciones Empezar/Adaptar
- Plan semanal manual + edición (`/dashboard/plan/[id]/edit`)
- Plan guiado “Crear con Coach Atlas” sobre catálogo real, con cleanup compensatorio
- Entrenar hub, rutinas, detalle de rutina y sesión guiada responsive
- Coach adaptation con preview/apply, freeText y fallback determinístico
- Post-workout feedback y Progreso con métricas honestas (consistencia, fuerza, bienestar, hábitos, sesiones)
- Perfil/Settings y bottom nav con tabs, iconos y estados activos

🚧 **En curso (Unreleased):**
- Convergencia final de Hoy (`components/today/**`)
- Generación semanal con Coach Atlas/Gemini en `lib/ai/weekly-plan-draft.ts`, conservando fallback determinístico

📚 **Handoff actual:** [`docs/backlog/handoff-2026-09.md`](./docs/backlog/handoff-2026-09.md)  
📝 **Cambios por versión:** [`CHANGELOG.md`](./CHANGELOG.md)

Stack y alcance: ver [`docs/architecture/ADR-001-system-stack.md`](./docs/architecture/ADR-001-system-stack.md).

Implementación solo tras brief PO + respeto al harness ([`AGENTS.md`](./AGENTS.md)).

---

Hecho para [Esteban Indiveri](https://github.com/EstebanIndiveri).
