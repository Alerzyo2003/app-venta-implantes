# App móvil (iOS / Android)

Aplicación de clientes de la plataforma, construida con **Expo SDK 58 + React Native 0.88 + TypeScript**
y **Expo Router** (rutas por archivos en `src/app/`). Se conecta directamente a Supabase: toda regla de
precio, stock, permisos y pagos se valida en la base de datos (RLS + funciones), nunca en la app.

> La identidad visual y el nombre son **provisionales** (decisión D-17). Se cambian en
> `packages/brand/src/brand.ts` y con variables de entorno de `app.config.ts`, sin tocar pantallas.

## Requisitos

- Node 22 (`.nvmrc` en la raíz) y pnpm 10.
- Para probar en un teléfono: Expo Go (SDK 58) o un *development build* de EAS (ver abajo).
  Aún no se ha probado en dispositivos físicos: la verificación hecha es de compilación, pruebas
  automatizadas y revisión visual de la versión web.

## Configuración

1. Desde la raíz del monorepo: `pnpm install`.
2. Copia `.env.example` a `.env.local` (no se versiona) y completa:
   - `EXPO_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase de **desarrollo**.
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: clave publicable (anon). **Nunca** la `service_role`.

Sin esas variables la app abre una pantalla de «configuración pendiente» en lugar de simular datos.
Hoy no hay un proyecto Supabase dedicado: su creación espera la aprobación de la decisión D-01
(`docs/07-decisiones-pendientes.md`).

## Ejecutar

```bash
pnpm --filter @repo/mobile start      # servidor de desarrollo (QR para dispositivo / simuladores)
pnpm --filter @repo/mobile web        # versión web de la app (útil para revisión visual)
```

## Comprobaciones

```bash
pnpm --filter @repo/mobile typecheck     # TypeScript estricto
pnpm --filter @repo/mobile lint          # ESLint (eslint-config-expo)
pnpm --filter @repo/mobile test          # Jest + Testing Library
pnpm --filter @repo/mobile export:check  # compila los bundles Hermes de iOS y Android
```

En entornos sin acceso a `api.expo.dev`, antepón `EXPO_OFFLINE=1` a los comandos de `expo`.

## Estructura

```
src/
  app/            Rutas (pantallas). (tabs) = barra inferior; (auth) = ingreso y registro.
  components/ui/  Sistema de componentes accesibles (botones, campos, estados, precios…).
  components/     Componentes de negocio (carrito, ficha, compatibilidad, WhatsApp…).
  features/       Acceso a datos por dominio (TanStack Query + supabase-js).
  lib/            Cliente Supabase, almacenamiento seguro de sesión, caché, utilidades.
  theme/          Tema claro/oscuro derivado de @repo/brand.
```

## Qué hace hoy (y qué no)

Funciona contra un backend Supabase con las migraciones de `supabase/migrations`:

- Registro (con aceptación versionada de términos y consentimientos separados), ingreso,
  recuperación de contraseña, perfil, direcciones con regiones y comunas oficiales, datos de
  facturación con RUT validado, solicitud de verificación profesional, preferencias y eliminación de cuenta.
- Catálogo por categorías, búsqueda por nombre, código, GTIN y medidas (p. ej. «4.1 x 10»),
  lectura de códigos GS1/UDI del envase con la cámara, ficha de producto con variantes, precio
  según perfil, disponibilidad real y **solo compatibilidades verificadas**.
- Favoritos y carrito (cantidades, precios y stock recalculados en el servidor).
- Consulta de pedidos con historial, pagos y seguimiento. Hoy la app todavía **no crea** pedidos:
  eso llega junto con el pago en línea.
- Modo sin conexión: avisa la falta de red y no muestra datos inventados.

Aún **no** disponible (se indica así en la app, sin botones simulados):

- **Pago en línea**: depende del proveedor y credenciales (decisiones D-03 y D-04). El carrito
  ofrece solicitar cotización por WhatsApp si se configura el número de contacto.
- Documentos técnicos almacenados en Storage (hoy solo se listan los que tienen enlace externo).
- Notificaciones push, cotizaciones PDF, compras recurrentes y demás módulos de fases posteriores.

## Variantes y publicación

`app.config.ts` define tres variantes según `APP_VARIANT` (lo fija cada perfil de `eas.json`):
`development` y `preview` agregan sufijo al identificador para convivir con la versión de tienda.
El identificador definitivo (`APP_BUNDLE_ID`) y el proyecto EAS (`EAS_PROJECT_ID`) dependen de las
cuentas de Apple, Google y Expo de la empresa (decisión D-11).

```bash
eas build --profile development --platform ios   # requiere cuenta Expo y credenciales de Apple
```

### Versión de prueba en Android (siguiente paso)

Se empieza por Android: una versión de prueba que se instala desde un enlace (perfil `preview`,
distribución interna de EAS), sin cuenta de Google Play. Para compilarla hace falta, en el entorno
donde se ejecuta `eas build`:

- `EXPO_TOKEN`: token de acceso de la cuenta Expo de la empresa, guardado como secreto del entorno
  (nunca en el repositorio ni en el chat).
- Acceso de red a `api.expo.dev` y `expo.dev`.
- `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` del proyecto de desarrollo como
  variables del entorno `preview` de EAS (son públicas: la URL y la clave publicable).

La app exige una versión mínima configurable desde el backend (`app_settings`, clave
`app.min_supported_version`), para obligar a actualizar cuando un cambio del servidor lo requiera.
