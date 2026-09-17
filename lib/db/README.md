# Database

Drizzle ORM schema, client, migrations y seed (file DB local o Turso).

Arranque localhost/Box: `docs/engineering/local-dev.md`.

```bash
npm run setup:local   # .env si falta + migrate + seed
npm run db:migrate
npm run db:seed
```

Default local: `TURSO_DATABASE_URL=file:./local.db` (sin token).

Ver `docs/architecture/ADR-001-system-stack.md` para decisiones técnicas.
