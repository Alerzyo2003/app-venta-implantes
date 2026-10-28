# Emulador local de Supabase (solo pruebas)

Servidor mínimo que imita **Supabase Auth** y la **API REST (PostgREST)** sobre la base
PostgreSQL local de `tools/local-db`. Existe porque este entorno no puede ejecutar Docker ni los
binarios oficiales de Supabase, y permite probar de punta a punta el panel con la base real
(migraciones, RLS, triggers y funciones).

> **No es Supabase y no lo reemplaza.** No se usa en producción ni en staging. Los resultados
> obtenidos con el emulador no acreditan que una integración con Supabase real funcione: eso se
> verifica contra un proyecto de desarrollo (decisión D-01).

## Qué cubre

- **REST**: `select` con columnas, alias y relaciones de un nivel (muchos-a-uno y uno-a-muchos,
  resueltas por las claves foráneas), filtros `eq/neq/gt/gte/lt/lte/like/ilike/is/in` (y `not.`),
  `order` (con `nullsfirst/nullslast`), `limit/offset`, `insert`, `upsert` (`on_conflict`),
  `update`, `delete` y llamadas RPC (`/rpc/<función>`). Cada solicitud se ejecuta en una
  transacción con `SET LOCAL ROLE authenticated|anon` y `request.jwt.claims`, igual que PostgREST,
  por lo que **RLS y los permisos son los reales**.
- **Auth**: inicio de sesión con contraseña (verificada con `pgcrypto` contra `auth.users`),
  renovación de sesión, usuario actual, cambio de contraseña, cierre de sesión, solicitud de
  recuperación (no envía correos) y MFA TOTP.

## Qué no cubre (diferencias conocidas)

- Relaciones anidadas de más de un nivel, conteos (`count=exact`), filtros sobre relaciones,
  búsqueda de texto de PostgREST y la mayoría de los encabezados `Prefer`.
- Correos (confirmación, recuperación, invitaciones), proveedores OAuth, límites de solicitudes,
  revocación real de sesiones y la caché de esquema de PostgREST.
- **MFA**: acepta siempre el código fijo `123456` y los factores viven en memoria (se pierden al
  reiniciar). Sirve solo para probar la interfaz.
- Los JWT se firman con una clave local fija y el servidor solo escucha en `127.0.0.1`.

## Uso

```bash
pnpm db:start                      # base local (tools/local-db)
pnpm --filter @repo/local-api start   # http://127.0.0.1:54331
```

Variables: `LOCAL_API_PORT` (54331), `LOCAL_DB_PORT` (54329), `LOCAL_DB_NAME` (implantes) o
`LOCAL_API_DATABASE_URL`.

Las pruebas de punta a punta del panel (`pnpm --filter @repo/admin test:e2e`) lo inician solas.
