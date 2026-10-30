# Backend (Supabase / PostgreSQL)

| Ruta | Contenido |
|---|---|
| `migrations/` | Esquema, RLS, funciones (RPC) y datos de referencia, en orden de aplicación |
| `tests/` | Pruebas de base de datos (Vitest + `pg`) |
| `seed.sql` | Semilla de desarrollo (vacía a propósito: sin datos ficticios) |
| `config.toml` | Configuración de la Supabase CLI para desarrollo local |

## Migraciones

| Archivo | Contenido |
|---|---|
| `0100_base` | Extensiones, utilidades (RUT, GTIN, códigos), configuración, auditoría, roles y permisos |
| `0200_identity` | Regiones y comunas, documentos legales, perfiles, consentimientos, verificación profesional, organizaciones, direcciones y facturación |
| `0300_catalog` | Referencias, productos, variantes, medios, documentos, compatibilidades con evidencia, alternativas y favoritos |
| `0400_pricing_inventory` | Listas de precios, costos, bodegas, saldos, lotes, movimientos, reservas e inventario (RPC) |
| `0500_orders` | Carrito, despacho, pedidos, pagos, reembolsos, envíos y sus RPC transaccionales |
| `0600_search` | Buscador (texto completo, trigramas, códigos y filtros) y sugerencias |
| `0700_reference_data` | Permisos, roles, configuración por defecto, categorías, regiones y comunas (CUT) |
| `0800_scheduled_jobs` | pg_cron: liberación de reservas vencidas (solo donde pg_cron existe) |
| `0900_admin_panel` | Funciones del panel (resumen, búsqueda de productos, inventario y movimientos), regla de publicación con variante activa, permiso para archivar e ingresos/ajustes idempotentes |

## Pruebas locales (sin Docker)

Requiere PostgreSQL 15 o superior instalado. Desde la raíz del repositorio:

```bash
pnpm install
pnpm test:db
```

`tools/local-db/reset.sh` crea un clúster en `.local/`, aplica la emulación mínima de Supabase
(`tools/local-db/bootstrap-*.sql`), todas las migraciones y la semilla. Ver
[ADR-0007](../docs/adr/0007-pruebas-bd-sin-docker.md) para sus alcances y limitaciones.

## Con la Supabase CLI (Docker)

```bash
npx supabase start
npx supabase db reset
```

## Despliegue a un proyecto remoto

```bash
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

Aplicar primero en desarrollo/staging y luego en producción. Nunca guardar la contraseña de la base ni la `service_role key` en el repositorio.

### Verificar que el proyecto coincide con las migraciones

`pnpm db:fingerprint` crea una base local temporal solo con las migraciones y muestra su huella:
una fila por tipo de objeto (funciones, privilegios, tablas, restricciones, índices, políticas,
disparadores, datos de referencia…). Ejecuta
[`tools/local-db/schema-fingerprint.sql`](../tools/local-db/schema-fingerprint.sql) en el editor
SQL del proyecto: las dos salidas deben ser idénticas. Si un tipo difiere, cambia la consulta final
del archivo por `select * from fp where kind = '<tipo>'` en ambos lados para ubicar el objeto.

## Proyecto de desarrollo (D-01)

| Dato | Valor |
|---|---|
| Proyecto | `plataforma-implantes-dev` (ref `snxzwnvhohzonzpypxxd`) |
| Región y plan | sa-east-1 (São Paulo), gratuito |
| Organización | «Clinica dignidad» |
| Creado | 2026-10-29 |

Estado de las migraciones (2026-10-30), aplicadas con el conector de Supabase:

| Migración | Estado |
|---|---|
| `0100` a `0400` | Aplicadas |
| `0500_orders` | Aplicada hasta `cart_clear` (línea 841). Falta desde «Cotización del carrito» (línea 842) hasta el final |
| `0600` a `0900` | Pendientes |

El conector registra cada migración con la fecha de aplicación como versión (por ejemplo
`20261029114852_base`). Al terminar, el historial (`supabase_migrations.schema_migrations`) debe
quedar con las versiones de los archivos (`20261028000100` … `20261028000900`), una por archivo,
para que `supabase db push` no intente reaplicarlas. Después se verifica con la huella y con los
avisos de seguridad y rendimiento de Supabase.

## Pendiente de verificar en un proyecto Supabase real (D-01)

- Programación con pg_cron (`0800`).
- Buckets y políticas de Storage para imágenes y documentos (se agregarán en el incremento 1).
- Flujos de Auth reales (verificación de correo, recuperación y MFA) contra GoTrue.
- Las consultas del panel y de la app contra PostgREST real (localmente se usa el emulador `tools/local-api`, que cubre solo un subconjunto).
