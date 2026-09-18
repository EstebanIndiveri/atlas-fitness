# AGENTS.md — Atlas Fitness

Harness obligatorio para humanos y agentes (PO Scrum, Arquitectura, Dev Backend, Dev Frontend, QA, Bot, cloud agents).  
**Antes de editar código:** leer este archivo + `docs/architecture/*` + `docs/engineering/*`.

## 1. Propósito

Un solo motor de trabajo: lineal, legible, escalable. Misma forma de pensar en FE y BE. Sin atajos que rompan contratos, tipado o tests.

## 2. Roles y supervisión

| Rol | Responsabilidad |
|-----|-----------------|
| **PO Scrum** | Alcance, MoSCoW, aceptación de producto. No mergea código. |
| **Arquitectura** | Criterio técnico, ADRs, **supervisión de ejecución** de los demás agentes, veto de atajos que rompan escala/estructura. Aprueba diseño antes de features grandes. |
| **Dev Backend** | APIs, schema, jobs, integraciones. Solo brief del PO. |
| **Dev Frontend** | UI PWA, hooks, componentes. Solo brief del PO. |
| **QA** | Plan Playwright/Jest, review de criterios, no aprueba Done de producto solo. |
| **Bot / cloud agent** | Implementa en worktree aislado bajo este harness. |

**Regla:** ningún agente empieza a implementar sin brief del PO **y** sin contexto de este harness. Arquitectura puede frenar o pedir rework si el PR viola ADRs o este documento.

## 3. Branching model (estándar development)

```
main          ← estable, solo vía release candidate
  ↑
release/*     ← release candidate (RC): integración + QA + code review
  ↑
develop       ← integración continua del equipo
  ↑
feature/*  |  fix/*   ← trabajo de un agente / una historia
```

- **feature/`slug`** o **fix/`slug`**: una historia o bug. Un writer principal por paths críticos.
- Merge a **`develop`** solo tras: CI verde + code review de agentes del squad + OK Arquitectura (si toca contratos/estructura) + OK PO (alcance).
- **`release/x.y.z`**: cortar desde `develop` cuando el incremento está listo; QA regresión; fixes solo en la RC (`fix/` → RC o cherry-pick).
- **`main`**: merge desde RC aprobada = versión estable. Tag `vX.Y.Z`.
- Prohibido push directo a `main` o `develop` sin PR.
- Prohibido dos agentes editando los **mismos archivos** en paralelo (usar worktrees / ownership de paths).

## 4. Worktrees y contexto

1. Cada agente trabaja en **su worktree** (o branch dedicada) desde el SHA acordado.
2. Paquete de tarea: objetivo único, invariantes, archivos permitidos, tests a crear/correr, **sin tocar producción**.
3. No compartir un checkout sucio entre Codex/Copilot/otro agente como co-writers.
4. Al terminar: diff revisable, lista de riesgos, evidencia de tests, dudas abiertas.
5. Integración solo el coordinador/Arquitectura o el flujo de PR; no "merge local improvisado".

## 5. Flujo de PR (obligatorio)

1. Abrir PR → `develop` (o → `release/*` si es hotfix de RC).
2. CI: lint + typecheck + **Jest unitario** + Playwright Must (cuando existan).
3. **Code review por agentes del squad** (mínimo: autor ≠ reviewer; Backend↔Frontend cruzado si toca contrato; QA en flujos Must; Arquitectura si toca ADR/estructura).
4. Resolver **todos** los comentarios de review (o documentar wontfix con OK Arquitectura/PO).
5. Aprobación explícita → merge.
6. Nada a `main` sin pasar por RC salvo hotfix crítico acordado con PO+Arquitectura.

## 6. TDD y tipado (no negociable)

- **TDD:** para cada función/módulo nuevo o cambio de comportamiento:
  1. Escribir test que falle (Jest).
  2. Implementar lo mínimo.
  3. Refactor manteniendo verde.
- Unit test **por función pura / servicio / mapper** con tipado fuerte.
- TypeScript **strict**; nada de `any` sin justificación en el PR; preferir `unknown` + narrowing.
- Contratos API: tipos compartidos; errores `{ code, message }` tipados (unión de códigos).
- `weight_kg` y dinero-like: **decimal string / numeric DB**, nunca `number` float en asserts de dominio.
- Zona horaria canónica: `America/Argentina/Cordoba`.

## 7. Organización del monorepo (Next App Router)

```
app/                 # rutas UI + api (thin)
  api/**/route.ts    # orquestación HTTP sola
components/          # UI reutilizable por dominio
features/            # (opcional) slices feature = ui + hooks locales
lib/                 # dominio, db, services, telegram, ai
  db/                # schema, client, migrations, queries
  services/          # casos de uso / application services
  */                 # adapters (telegram, ai, …)
hooks/               # hooks compartidos (si no viven en features/)
types/               # tipos compartidos FE/BE
docs/
  architecture/      # ADRs
  backlog/           # MoSCoW, historias
  engineering/       # convenciones FE/BE
```

- Rutas API **delgadas**; lógica en `lib/services` o módulos de dominio.
- Telegram: webhook thin + handlers **modulares** (nunca un solo archivo gigante).

## 8. Orden dentro de un archivo `.ts` / `.tsx`

1. `'use client'` / `'use server'` (si aplica)
2. Imports (ver §9)
3. Tipos / interfaces locales
4. Constantes
5. Helpers puros (o mover a `lib/` si se reusan)
6. Hooks
7. Componente(s) / handlers de route
8. Exports públicos al final (si no hay export inline)

Máximo orientativo: **~200–250 líneas** por archivo. Si crece → extraer hook, subcomponente o service.

## 9. Imports

Orden:

1. Framework (`react`, `next/*`)
2. Librerías externas
3. Internos absolutos (`@/lib/...`, `@/components/...`)
4. Relativos
5. Tipos (`import type`)

Sin imports circulares. Sin dead imports.

## 10. Frontend (React / Next)

- Mobile-first PWA; estados vacío / carga / error obligatorios.
- **No** un TSX monolito: descomponer en componentes + hooks personalizados.
- Antes de crear: **buscar** componente/hook/util existente.
- Si se usa en ≥2 lugares → `components/`, `hooks/` o `lib/`.
- Sin lógica de negocio pesada en JSX; va a hooks/services.
- Accesibilidad básica (labels, teclado, contraste).
- No duplicar formatters de fecha/peso: utils tipados compartidos (`es-AR`, decimal).

## 11. Backend

- Mismos principios: no repetir; consolidar **services**, middlewares, validators (Zod), modelos Drizzle, constantes de error.
- Controllers/routes = validar + auth + llamar service + mapear error.
- Idempotencia donde haya webhooks/crons/pagos-like (`update_id`, `client_mutation_id` cuando aplique).
- Soft delete según ADR; queries list **excluyen** deleted por defecto.
- Un writer en paths financieros/de sets concurrentes; tests negativos de carrera.

## 12. Estilo y componentización

- Tokens/espaciado/tipografía en hoja de estilos / theme única (no magia hardcodeada suelta).
- Variantes de UI vía props tipadas o CVA-like; no copiar-pegar clases.
- Nombres en inglés en código; copy de producto en español (`es-AR`) vía constantes/i18n simple.

## 13. Checklist pre-PR (agente)

- [ ] Leí `AGENTS.md` + ADRs relevantes
- [ ] Busqué código existente antes de crear
- [ ] Tests unitarios nuevos/actualizados (TDD)
- [ ] Tipado strict, sin `any` injustificado
- [ ] Archivos acotados; hooks/componentes extraídos
- [ ] Worktree/branch correcta; sin pisar paths ajenos
- [ ] Contratos FE↔BE alineados
- [ ] CI local verde (lint, tsc, jest, e2e Must si aplica)

## 14. Referencias

- `docs/architecture/ADR-001-system-stack.md`
- `docs/architecture/ADR-002-client-channels.md`
- `docs/architecture/ADR-001b-habit-motivation.md`
- `docs/architecture/ADR-003-gemini-guided-session.md`
- `docs/backlog/README.md`
- `docs/engineering/conventions-fe.md`
- `docs/engineering/conventions-be.md`
- `docs/engineering/local-dev.md`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
