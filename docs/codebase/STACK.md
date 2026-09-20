# Stack actual

## Resumen

Atlas Fitness es una aplicación Next.js única, escrita en TypeScript y
desplegable como monolito. El stack principal es reciente y apropiado para una
beta: Next.js 16, React 19, Drizzle y libSQL/Turso.

## Runtime y aplicación

| Área | Tecnología | Versión |
|---|---|---:|
| Runtime | Node.js | 20 en CI; 20+ documentado |
| Lenguaje | TypeScript | 6.0.3 |
| Framework | Next.js App Router | 16.3.5 |
| UI | React / React DOM | 19.3.0 |
| Estilos | Tailwind CSS | 4.3.3 |

El repositorio usa módulos ES mediante la configuración TypeScript/Next, pero
no declara `"type": "module"` en `package.json`. Tampoco fija `engines`,
`packageManager`, `.nvmrc` o `.node-version`.

## Datos y dominio

| Tecnología | Versión | Uso |
|---|---:|---|
| Drizzle ORM | 0.45.2 | Schema y consultas |
| libSQL client | 0.18.0 | SQLite local o Turso |
| drizzle-kit | 0.31.10 | Migraciones |
| Zod | 4.6.5 | Validación de algunas rutas |
| bcryptjs | 3.0.3 | Password hashing |

`lib/db/client.ts` usa `TURSO_DATABASE_URL` o cae en
`file:./local.db`. El schema conserva `weight_kg` como texto para evitar
errores de punto flotante.

## PWA

La PWA no usa una librería generadora. Está implementada con:

- manifest App Router en `app/manifest.ts`;
- política tipada en `lib/pwa/`;
- service worker manual en `public/sw.js`;
- registro desde `components/pwa/ServiceWorkerRegister.tsx`;
- iconos y página offline en `public/`.

El service worker precachea el shell y excluye `/api/*`, una decisión segura
para datos autenticados.

## Integraciones

- Telegram Bot API mediante `fetch`.
- Google Gemini mediante REST server-side.
- Turso/libSQL.
- GitHub Actions para CI.

Gemini usa `gemini-2.0-flash`, timeout de cuatro segundos y fallback
determinista. No usa SDK oficial ni JSON Schema.

## Tooling

| Herramienta | Versión |
|---|---:|
| ESLint | 9.39.5 |
| Jest | 30.5.1 |
| Playwright | 1.63.0 |
| Testing Library React | 16.3.3 |
| Testing Library jest-dom | 7.0.1 |
| ts-jest | 29.4.12, instalado pero no configurado |

Scripts disponibles:

```text
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run test:watch
npm run test:e2e
npm run db:migrate
npm run db:seed
npm run setup:local
```

No hay script de coverage ni de generación Drizzle. La cobertura auditada se
obtuvo invocando Jest con `--coverage`.

## Dependencias y configuración

`drizzle-kit`, `typescript` y paquetes `@types/*` están en `dependencies`,
aunque son tooling. `npm audit` reportó cuatro vulnerabilidades moderadas en
una cadena transitiva de `drizzle-kit`/esbuild; no se encontró ejecución de esa
cadena en el runtime web.

Variables documentadas:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SESSION_SECRET`
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `GEMINI_API_KEY`
- `NODE_ENV`

No existe validación central de entorno. Algunas ausencias activan defaults
inseguros o un modo stub.

## Evaluación

**Actual:** stack moderno, pequeño y mantenible para MVP/beta.

**Pendiente para producción:** pin de runtime, validación de entorno,
observabilidad, supply-chain automation, actualización de Gemini y separación
correcta entre dependencias de runtime y desarrollo.

## Evidence

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `tailwind.config.ts`
- `jest.config.ts`
- `playwright.config.ts`
- `drizzle.config.ts`
- `.env.example`
- `.github/workflows/ci.yml`
- `lib/db/client.ts`
- `lib/ai/gemini.ts`
- `app/manifest.ts`
- `public/sw.js`
