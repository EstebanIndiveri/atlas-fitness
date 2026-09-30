# Docs — Atlas Fitness

| Carpeta | Contenido |
|---------|-----------|
| `architecture/` | ADRs (sistema, canales, hábito) |
| `backlog/` | MoSCoW Must v2 y orden de entrega |
| `engineering/` | Convenciones FE/BE/QA + **local-dev** (localhost y Box) |
| `operations/` | Runbooks y evidencia operativa (smoke autenticado de producción) |

- Arranque local/Box (smoke sin red + integraciones reales opcionales): [`engineering/local-dev.md`](./engineering/local-dev.md)
- Smoke autenticado de producción (controles de plataforma H1): [`operations/2026-09-30-production-smoke-h1-platform-evidence.md`](./operations/2026-09-30-production-smoke-h1-platform-evidence.md)
- Smoke autenticado de producción (runbook del operador H4): [`operations/production-auth-smoke-runbook.md`](./operations/production-auth-smoke-runbook.md)
- Smoke autenticado de producción (esquema de evidencia H4): [`operations/production-auth-smoke-evidence-schema.md`](./operations/production-auth-smoke-evidence-schema.md)
- Smoke autenticado de producción (evidencia de ejecución H5 v0.11.0, **PASS**): [`operations/2026-09-30-production-smoke-h5-execution-evidence.md`](./operations/2026-09-30-production-smoke-h5-execution-evidence.md)

Harness de agentes y branching: **`/AGENTS.md`** (raíz del repo).
