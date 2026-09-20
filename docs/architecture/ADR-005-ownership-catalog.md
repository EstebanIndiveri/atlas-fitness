# ADR-005 — Ownership del catálogo (ejercicios y rutinas)

**Estado:** Aprobado (Squad / PO, 2026-09-18); implementado en PR #22 (sha ~`4dded2ed7c`)  
**Producto:** Atlas Fitness  
**Complementa:** ADR-001 (tenancy `user_id`), `docs/engineering/p1-2-ownership.md`

## Contexto

Ejercicios y rutinas no filtraban por dueño: un usuario autenticado podía leer o
mutar filas custom de otro. Riesgo de fuga de datos entre usuarios.

El catálogo mezcla filas **sistema** (seed compartido, `is_system`) y filas
**custom** (`user_id` del dueño). La visibilidad y mutación tienen que ser
explícitas y compartidas, no reimplementadas por ruta.

Esta decisión cierra P1.2 (ownership). No cambia el modelo de sesión (ADR-004)
ni el de sesión guiada (ADR-003).

## Decisión

1. **Visibilidad:** `isSystem === true` **o** `userId === session.userId`.
   Helper único en `lib/auth/ownership.ts`: `canAccessCatalogItem`,
   `assertCanAccessCatalogItem`, `assertCanMutateCatalogItem`,
   `catalogVisibleToUser`.
2. **Mutación:** solo filas custom propias. El catálogo sistema es de solo
   lectura para clientes (`FORBIDDEN`).
3. **GET de id ajeno o inaccesible → `NOT_FOUND` (404)**, nunca 403. No filtrar
   existencia de filas de otro usuario.
4. **Listados:** `WHERE is_system OR user_id = ?` (vía `catalogVisibleToUser`).
5. **Workouts:** crear con `routineId` ajeno → `VALIDATION` (igual que id
   desconocido). Sets con `exerciseId` ajeno → `NOT_FOUND`.
6. **DTOs** omiten `userId`.

## Consecuencias

- Aislamiento multi-usuario del catálogo; las filas seed de sistema siguen
  compartidas (lectura).
- Editor visual de rutinas / ejercicios y rate-limit quedan fuera de este ADR.
- Tests: sistema visible; custom propio visible; ajeno → 404; listados no
  incluyen custom de otros.

## Fuera de alcance

- Rate-limit (P1.3)
- Mini App
- UI de editor de rutinas
