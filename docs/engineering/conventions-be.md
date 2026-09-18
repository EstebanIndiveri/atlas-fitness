# Convenciones Backend — Atlas Fitness

Ver también `AGENTS.md` §§7–8, §11 y ADR-001.

## Capas

```
route.ts → validate (Zod) → auth/session → service → db/adapter → response
```

- `lib/services/*`: casos de uso.
- `lib/db/*`: schema, client, queries.
- `lib/telegram/*`: handlers por comando (modular).
- Códigos de error en unión tipada compartida.

## Reglas

- Soft delete: listados filtran `deleted_at IS NULL`.
- Webhooks/crons: idempotencia obligatoria.
- Sets/PR: evitar TOCTOU; tests negativos.
- Crons: Bearer `CRON_SECRET`; tip/nudge por usuario linkeado (no env chat global).
- Decimal para `weight_kg` en DB y serialización string en JSON de dominio cuando aplique.
- Catálogo (ejercicios/rutinas): `isSystem || userId === currentUser` vía `lib/auth/ownership.ts`. Recurso ajeno → `NOT_FOUND` (404, sin filtrar existencia). Listados: sistema + propios. DTOs sin `userId`.

## Anti-patrones

- Lógica de negocio en `route.ts`.
- Handlers Telegram monolíticos.
- `any`, floats para pesos, Map in-memory como única defensa de auth a largo plazo.
