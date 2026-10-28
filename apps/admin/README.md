# Panel administrativo (Next.js)

Panel interno para el personal: catálogo, precios, inventario y bodegas. Construido con
**Next.js 16 (App Router)**, React 19, TypeScript, Tailwind CSS 4 y `@supabase/ssr`.

## Principios de seguridad

- **Sin `service_role`**: el panel usa solo la clave publicable de Supabase y la sesión del usuario
  (cookies). Cada consulta pasa por RLS y cada operación sensible por funciones de la base que
  vuelven a validar permisos (`private.has_permission`).
- **MFA obligatoria para el personal** (TOTP). Mientras la sesión no tenga nivel `aal2`, la base
  rechaza las operaciones del personal y el panel redirige a la verificación en dos pasos.
- **Validación en tres capas**: formulario (zod) → acción del servidor (sesión, permiso y datos,
  nunca confía en la página) → base de datos (RLS, restricciones y triggers).
- **CSP con nonce por solicitud**, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS y `noindex` (ver `src/proxy.ts` y `next.config.ts`).
- Redirecciones solo a rutas internas (sin redirecciones abiertas) y mensajes de error en español
  sin detalles técnicos.
- Ingresos y ajustes de inventario **idempotentes**: un reenvío no duplica el movimiento.

## Qué incluye

| Sección | Funciones | Permisos |
|---|---|---|
| Acceso | Inicio de sesión, enrolamiento y verificación TOTP, recuperación de contraseña, cierre de sesión, bloqueo de cuentas sin rol | Personal interno |
| Inicio | Resumen calculado en la base: productos por estado, agotados, últimas unidades, lotes por vencer, vencidos y bloqueados, pedidos por estado y verificaciones pendientes (cada bloque según permisos) | Cualquiera del personal |
| Productos | Búsqueda (nombre, marca, SKU, código del fabricante o GTIN), filtros y paginación; crear, editar, publicar, pasar a borrador, archivar y restaurar; variantes con GTIN validado, medidas, plataforma y conexión según el tipo; precio neto de la lista base con vista previa del IVA | `catalog.*`, `prices.*` |
| Inventario | Disponible por variante (todas las bodegas o una), alertas, saldos por bodega, lotes con estado y vencimiento, ingreso, ajuste con motivo, cambio de estado de lotes y libro de movimientos con responsable | `inventory.*` |
| Bodegas | Lista, creación y edición (comuna, prioridad, vendible, punto de retiro) | `inventory.read`, `warehouses.manage` |

La navegación muestra solo las secciones permitidas y solo las que existen: no hay accesos a
módulos aún no construidos.

**Pendiente** (próximos incrementos): referencias del catálogo (marcas, fabricantes, sistemas,
plataformas, tipos de conexión y categorías), fotos y documentos (Storage), compatibilidades con
evidencia, importación y exportación CSV, pedidos y despacho, clientes y verificación profesional,
usuarios y roles, auditoría y configuración.

## Configuración

1. Desde la raíz: `pnpm install`.
2. Crea `apps/admin/.env.local` a partir de `.env.example`:
   - `SUPABASE_URL`: URL del proyecto Supabase.
   - `SUPABASE_ANON_KEY`: clave publicable (anon o `sb_publishable_…`). **Nunca** la `service_role`.
3. En el proyecto Supabase (Authentication):
   - Habilitar **MFA con TOTP**.
   - En *URL Configuration*, agregar la URL del panel y `https://<dominio-del-panel>/auth/confirm`
     a las URL de redirección permitidas (recuperación de contraseña).
4. Aplica las migraciones (`supabase/README.md`).

Sin las variables, el panel muestra «Configuración pendiente» en vez de simular datos.

### Primer administrador

Los roles solo los asigna quien ya tiene `users.manage_roles`. Para el primer administrador, crea
la cuenta (registro en la app o invitación desde Supabase Auth) y ejecuta en el editor SQL del
proyecto (sesión de base de datos, no la API):

```sql
insert into public.user_roles (user_id, role_code)
select id, 'admin_general' from auth.users where email = 'correo@empresa.cl';
```

Al ingresar al panel se le pedirá configurar la verificación en dos pasos.

## Ejecutar

```bash
pnpm --filter @repo/admin dev      # http://localhost:3001
pnpm --filter @repo/admin build && pnpm --filter @repo/admin start
```

## Pruebas

```bash
pnpm --filter @repo/admin typecheck
pnpm --filter @repo/admin lint
pnpm --filter @repo/admin test       # unitarias (Vitest)
```

Pruebas de punta a punta (Playwright) contra la base local y el emulador de Supabase
([`tools/local-api`](../../tools/local-api/README.md)). Reinician la base local y crean cuentas de
prueba:

```bash
pnpm db:start
pnpm --filter @repo/admin test:e2e
```

Si el navegador de Playwright no está instalado: `pnpm --filter @repo/admin exec playwright install chromium`.

> Las pruebas con el emulador verifican la interfaz, los permisos y las reglas de la base real,
> pero **no** reemplazan las pruebas contra Supabase Auth y PostgREST reales, pendientes hasta
> contar con el proyecto de desarrollo (D-01).

## Estructura

```
src/
  proxy.ts            CSP con nonce, renovación de sesión y redirección a /login
  app/(auth)/         Ingreso, MFA, recuperación y nueva contraseña, sin acceso
  app/(panel)/        Secciones del panel (cada página valida acceso y permisos)
  app/auth/confirm/   Destino de los enlaces de correo de Supabase Auth
  components/         Interfaz (ui/), estructura (shell/) y formularios por módulo
  lib/auth/           Capa de acceso (DAL), acciones de autenticación, rutas seguras
  lib/data/           Consultas a Supabase (solo servidor)
  lib/schemas/        Validación de formularios (zod)
e2e/                  Pruebas de punta a punta
```
