# Atlas Fitness

Asistente de fitness personal para registrar entrenamientos, pesos, consejos, media de ejercicios y motivación — vía **web app** y **bot de Telegram** (misma lógica de producto que Hermes Finance: un dominio, dos canales).

> Estado: **Phase 1 Scaffold** — Estructura base lista para Must v2. Sin implementación de features de producto todavía.

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
- **PWA:** Manifest + installable (icons placeholder)
- **Database:** Turso/libSQL + Drizzle (pendiente)
- **Channels:** Web App + Telegram Bot (pendiente)

## Desarrollo Local

### Pre-requisitos

- Node.js 20+
- npm (incluido con Node)

### Setup

```bash
# Clonar el repositorio
git clone https://github.com/EstebanIndiveri/atlas-fitness.git
cd atlas-fitness

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

### Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo (con Turbopack)
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
│   ├── db/               # Database schema y queries (pendiente)
│   ├── services/         # Application services (pendiente)
│   ├── telegram/         # Telegram bot handlers (pendiente)
│   ├── ai/               # IA integrations (pendiente)
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

## Estado Actual (Phase 1 Scaffold)

✅ **Completado:**
- Next.js App Router + TypeScript strict
- Estructura de directorios según AGENTS.md
- Jest configurado con tests TDD (weight formatter)
- Playwright smoke test (home page)
- GitHub Actions CI (lint + typecheck + test + e2e)
- PWA manifest + placeholders de íconos
- Documentación completa (ADRs, convenciones)

🔜 **Próximo (Must v2):**
- Auth + link Telegram
- Workouts/sets/reps/peso
- Catálogo de ejercicios
- Tip card + Stories
- Streaks + motivación
- Database schema (Turso + Drizzle)

Stack y alcance: ver [`docs/architecture/ADR-001-system-stack.md`](./docs/architecture/ADR-001-system-stack.md).

Implementación solo tras brief PO + respeto al harness ([`AGENTS.md`](./AGENTS.md)).

---

Hecho para [Esteban Indiveri](https://github.com/EstebanIndiveri).
