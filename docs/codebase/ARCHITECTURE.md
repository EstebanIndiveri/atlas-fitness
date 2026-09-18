# Arquitectura actual

## Diagnóstico

Atlas Fitness es un monolito modular serverless-first. Es una arquitectura
adecuada para el tamaño y el equipo actuales; no hay justificación para
microservicios. La prioridad es reforzar límites internos, integridad y
operación.

## Componentes

```text
React PWA / Telegram
        |
Next.js pages, proxy y Route Handlers
        |
auth + validación HTTP
        |
application services
        |
Drizzle/libSQL ---- Telegram API
        |
      Gemini API (solo sesión guiada, con fallback)
```

## Flujos

### Web

La UI usa `fetch` contra 23 Route Handlers. `proxy.ts` protege navegación bajo
`/dashboard`, mientras cada API privada vuelve a ejecutar `requireAuth`.

Las rutas suelen delegar a servicios, pero la validación es heterogénea:
workouts/sets usan Zod; auth valida manualmente dentro del service y recibe JSON
tipado sin runtime schema; rutinas validan IDs con `parseInt`.

### Workout manual

```text
dashboard -> crear workout -> agregar/editar/borrar sets
          -> finalizar con nota/mood -> streak -> historial/PR
```

La UI oculta mutaciones cuando el workout terminó, pero los services de update
y delete de sets no refuerzan esa regla. Tampoco existe una restricción de un
solo workout activo.

### Sesión guiada

Una rutina seed crea un workout normal con `routineId`. El hook registra sets,
solicita el siguiente ejercicio y muestra cierre/streak/mejoras.

Gemini solo propone texto y un ID entre pendientes. Si falta key, hay timeout,
HTTP error o JSON inválido, se usa el orden determinista de la rutina. Esta
degradación es una decisión arquitectónica sólida.

### Telegram

El webhook valida forma mínima, persiste `update_id`, resuelve identidad por
Telegram y despacha a handlers modulares. Los handlers reutilizan services.

El registro de idempotencia ocurre antes del side effect; una falla posterior
puede impedir un retry útil.

## Fortalezas

- Separación razonable entre HTTP, services, DB y adapters.
- Services compartidos por web, Telegram y crons.
- TypeScript strict y decimal string para pesos.
- Errores de dominio tipados con `AppError`.
- Soft delete y constraints únicos en entidades relevantes.
- Rutinas guiadas reutilizan workouts/sets en vez de crear un dominio paralelo.
- IA opcional con allowlist y fallback.
- PWA no cachea API autenticada.

## Deuda arquitectónica

### Contratos

La UI importa tipos Drizzle. Los contratos JSON no modelan explícitamente la
serialización de fechas. Conviene introducir DTOs compartidos y mappers para
workouts, sets, exercises, routines y stats.

### Invariantes y transacciones

- múltiples workouts activos son posibles;
- update/delete de sets finalizados es posible;
- finalizar workout y actualizar streak no es atómico;
- creación de workout no valida ownership de rutina;
- creación/update de set no valida ownership del ejercicio.

### Carga de datos

Las páginas privadas cargan datos en Client Components. Esto genera estados de
carga y round-trips adicionales. Next.js 16 favorece una DAL server-only y
Server Components para la carga inicial, manteniendo clientes para interacción.

### Escala

- historial y PRs no tienen paginación;
- streak relee toda la actividad del usuario;
- cron de nudge relee workouts finalizados globales;
- rutinas hacen una consulta adicional por rutina;
- resumen diario consulta sets por workout;
- cierre guiado consulta ejercicios e historial por ejercicio;
- notificaciones consultan y envían secuencialmente por usuario;
- faltan índices para varios filtros/joins.

## Evolución recomendada

1. Corregir autenticación, ownership e invariantes.
2. Aislar DB de tests.
3. Centralizar validación de entorno y request schemas.
4. Introducir DTOs y DAL server-only.
5. Paginar, agrupar queries e indexar según métricas.
6. Añadir observabilidad y ejecución confiable de jobs.
7. Evaluar servicios separados solo cuando la carga lo justifique.

## Evidence

- `proxy.ts`
- `app/api/`
- `app/dashboard/`
- `hooks/useGuidedSession.ts`
- `lib/auth/`
- `lib/services/`
- `lib/session/`
- `lib/telegram/`
- `lib/ai/gemini.ts`
- `lib/db/schema.ts`
- `docs/architecture/ADR-003-gemini-guided-session.md`
