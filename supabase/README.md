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

## Pendiente de verificar en un proyecto Supabase real (D-01)

- Programación con pg_cron (`0800`).
- Buckets y políticas de Storage para imágenes y documentos (se agregarán en el incremento 1).
- Flujos de Auth reales (verificación de correo, recuperación y MFA) contra GoTrue.
