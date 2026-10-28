# ADR-0007 · Pruebas de base de datos sin Docker

- **Estado**: Aceptada — 2026-10-28

## Contexto
El camino estándar es `supabase start`, que usa Docker. En el entorno de desarrollo remoto donde se construyó la base del proyecto no se pudieron descargar las imágenes de Supabase (límites de Docker Hub y de ECR, y GHCR bloqueado por la red), y la política del entorno no permite ejecutar binarios descargados. Las reglas críticas (RLS, transacciones y concurrencia) deben probarse igualmente.

## Decisión
- `tools/local-db` levanta un PostgreSQL local (16 o superior) con un **bootstrap de compatibilidad** que crea lo que las migraciones necesitan de Supabase: roles `anon`, `authenticated` y `service_role`, el esquema `auth` con `auth.users` y las funciones `auth.uid()`, `auth.jwt()` y `auth.role()`, que leen `request.jwt.claims` igual que en Supabase.
- Las pruebas (Vitest + `pg`) simulan las peticiones de la API: `set local role authenticated` y `set_config('request.jwt.claims', …)`, igual que PostgREST.
- El CI usa el mismo mecanismo con un contenedor de servicio de PostgreSQL.

## Limitaciones
- No prueba Auth (GoTrue), PostgREST ni Storage reales. Esas pruebas se harán contra un proyecto Supabase de desarrollo (D-01) o con `supabase start` en un equipo con Docker.
- El bootstrap emula solo lo necesario. Antes de cada despliegue, las migraciones se validan también con `supabase db reset` o en el proyecto de staging.
