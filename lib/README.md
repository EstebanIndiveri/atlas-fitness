# Lib — Dominio, servicios y adapters

Lógica de negocio, acceso a datos, integraciones externas.

## Estructura

- `db/` — Drizzle schema, client, migrations, queries
- `services/` — Casos de uso / application services
- `telegram/` — Handlers modulares del bot de Telegram
- `ai/` — Integración con servicios de IA para tips y consejos
- `format/` — Formatters compartidos (peso, fecha, etc.)

## Principios

- Ver `AGENTS.md` §7, §11
- Ver `docs/engineering/conventions-be.md`
- Tipado estricto
- Funciones puras donde sea posible
- Tests unitarios obligatorios
- Sin lógica en route handlers, solo orquestación
