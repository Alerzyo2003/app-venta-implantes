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
| `1000_api_privileges` | Las funciones que exigen sesión dejan de ser ejecutables sin ella (aviso de seguridad de Supabase) |

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
SQL del proyecto: las dos salidas deben ser idénticas. Si el proyecto aún no tiene todas las
migraciones, `pnpm db:fingerprint <versión>` aplica solo hasta esa versión. Si un tipo difiere,
cambia la consulta final del archivo por `select * from fp where kind = '<tipo>'` en ambos lados
para ubicar el objeto.

## Proyecto de desarrollo (D-01)

| Dato | Valor |
|---|---|
| Proyecto | `plataforma-implantes-dev` (ref `snxzwnvhohzonzpypxxd`) |
| URL de la API | `https://snxzwnvhohzonzpypxxd.supabase.co` |
| Región y plan | sa-east-1 (São Paulo), gratuito; PostgreSQL 17 |
| Organización | «Clinica dignidad» |
| Creado | 2026-10-29 |

Estado al 2026-10-30:

- **Las 10 migraciones están aplicadas y verificadas**: la huella del proyecto coincide en los 11
  tipos de objeto con `pnpm db:fingerprint`.
- **Historial alineado**: `supabase_migrations.schema_migrations` tiene una fila por archivo, con
  su versión (`20261028000100` … `20261028001000`), así que `supabase db push` solo aplicará
  migraciones nuevas. El conector de Supabase registra cada migración con la fecha en que se
  aplica: después de usarlo, se cambia la versión registrada por la del archivo.
- **pg_cron** libera las reservas vencidas cada minuto sin errores.
- **Auth**: registro abierto con correo confirmado obligatorio (solo proveedor de correo).
- **Avisos de Supabase revisados**:

| Aviso | Estado |
|---|---|
| Funciones `SECURITY DEFINER` ejecutables sin sesión | Corregido con `1000`. Quedan abiertas a propósito `get_variant_prices` y `get_availability` (catálogo público). Una prueba de base de datos impide exponer otras |
| Funciones `SECURITY DEFINER` ejecutables con sesión (25) | Por diseño: son las operaciones de la API y cada una valida sesión, MFA y permisos en el servidor (pruebas de base de datos) |
| `inventory_requests` con RLS y sin políticas | Por diseño: solo la usan las funciones de inventario |
| Varias políticas permisivas de lectura en 15 tablas | Las políticas de escritura `for all` también cubren la lectura. El costo es mínimo (cada permiso se evalúa una vez por consulta); se separarán por operación cuando haya volumen real |
| Claves foráneas sin índice (36) e índices sin uso (49) | Base sin datos: se revisarán con el uso real para no agregar índices que solo encarecen las escrituras |

## Pendiente de verificar en el proyecto de desarrollo

- Buckets y políticas de Storage para imágenes y documentos (se agregarán en el incremento 1).
- Flujos de Auth con cuentas reales (verificación de correo, recuperación y MFA): requieren el
  correo transaccional (D-08) o crear las cuentas desde el dashboard.
- Las consultas con sesión (cliente y personal) contra PostgREST real. Ya está verificado el acceso
  anónimo: catálogo, configuración pública, búsqueda y rechazo de escrituras y funciones protegidas.
