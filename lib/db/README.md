# Database

Drizzle ORM schema, client, migrations y seed (file DB local o Turso).

Arranque localhost/Box: `docs/engineering/local-dev.md`.

```bash
npm run setup:local   # .env si falta + migrate + seed QA solo con file: DB
npm run db:migrate
npm run db:seed
```

Default local: `TURSO_DATABASE_URL=file:./local.db` (sin token).
`npm test` **no** usa esa URL: Jest crea un file DB aislado en `/tmp` y rechaza `local.db` / Turso.
Si tu `.env` apunta a `libsql://…`, usá el bootstrap remoto documentado en `docs/engineering/local-dev.md`.

Ver `docs/architecture/ADR-001-system-stack.md` para decisiones técnicas.
