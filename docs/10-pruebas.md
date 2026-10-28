# Pruebas

Última actualización: 2026-10-28.

Estrategia general en [06-plan-de-implementacion.md §5](06-plan-de-implementacion.md#5-estrategia-de-pruebas).

> Regla: aquí solo se registran pruebas **efectivamente ejecutadas**, con su fecha, el comando y el resultado real.

## Cómo ejecutarlas

Requisitos: Node 22, pnpm 10 y PostgreSQL 15+ (para la base local sin Docker). Desde la raíz:

```bash
pnpm install
pnpm typecheck                         # TypeScript en todos los paquetes
pnpm lint                              # ESLint (panel con 0 advertencias) y expo lint
pnpm --filter @repo/brand test         # contraste de colores (WCAG AA)
pnpm --filter @repo/domain test        # reglas de negocio compartidas
pnpm test:db                           # reinicia la base local y prueba RLS, RPC y concurrencia
pnpm --filter @repo/mobile test        # componentes de la app (Jest)
pnpm --filter @repo/admin test         # unitarias del panel (Vitest)
pnpm db:start && pnpm --filter @repo/admin test:e2e   # panel de punta a punta (Playwright)
EXPO_OFFLINE=1 pnpm --filter @repo/mobile export:check  # compila iOS y Android (Hermes)
```

`EXPO_OFFLINE=1` solo es necesario donde `api.expo.dev` no es accesible.

La integración continua ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) ejecuta todo lo anterior en cada envío a `main` o a ramas `claude/**` y en cada pull request.

## Registro de ejecuciones

| Fecha | Suite | Comando | Resultado |
|---|---|---|---|
| 2026-10-28 | Identidad visual: contraste WCAG AA de la paleta clara y oscura | `pnpm --filter @repo/brand test` | **39/39** aprobadas |
| 2026-10-28 | Dominio: dinero e IVA (vectores compartidos con SQL), RUT, teléfonos, búsqueda y medidas, GTIN y GS1/UDI, estados, errores, validaciones | `pnpm --filter @repo/domain test` | **116/116** aprobadas |
| 2026-10-28 | Base de datos: PostgreSQL 16 local con emulación de roles y claims de Supabase, 9 migraciones | `pnpm test:db` | **199/199** aprobadas |
| 2026-10-28 | App móvil: componentes, almacenamiento seguro de sesión, reintentos y utilidades (Jest + Testing Library) | `pnpm --filter @repo/mobile test` | **19/19** aprobadas |
| 2026-10-28 | App móvil: TypeScript estricto y ESLint | `pnpm --filter @repo/mobile typecheck` · `lint` | Sin errores |
| 2026-10-28 | App móvil: compilación de producción (Hermes) | `EXPO_OFFLINE=1 pnpm --filter @repo/mobile export:check` | iOS 4,6 MB y Android 4,9 MB generados |
| 2026-10-28 | App móvil: revisión visual de la versión web (Playwright, 390×844, claro y oscuro, backend inaccesible) | capturas automatizadas | Correcta después de corregir 3 defectos (ver abajo) |
| 2026-10-28 | Panel: unitarias (rutas seguras, CSP, cookies de sesión, permisos, navegación, formularios, errores, esquemas, utilidades) | `pnpm --filter @repo/admin test` | **63/63** aprobadas |
| 2026-10-28 | Panel: TypeScript, ESLint (0 advertencias) y compilación de producción | `typecheck` · `lint` · `build` | Sin errores; todas las páginas se generan por solicitud |
| 2026-10-28 | Panel: punta a punta con Playwright contra la base local y el emulador `tools/local-api` | `pnpm --filter @repo/admin test:e2e` | **6/6** aprobadas |
| 2026-10-28 | Panel: revisión visual (1280 y 390 px, claro y oscuro) | capturas automatizadas | Sin errores de consola ni bloqueos de CSP; sin desplazamiento horizontal en móvil |

### Qué cubren

- **Base de datos (199)**: aislamiento por RLS entre clientes y por rol del personal; MFA exigida
  al personal (`aal2`); funciones de catálogo, búsqueda (texto, tildes, errores de escritura,
  códigos y medidas), compatibilidades solo con evidencia; precios e IVA con los mismos vectores
  que el dominio; inventario (ingresos con lote y vencimiento, ajustes con motivo, sin stock
  negativo, libro inmutable, cuarentena, FEFO); pedidos idempotentes, reservas y su vencimiento,
  **sin sobreventa con dos compras simultáneas por las últimas unidades**, pagos idempotentes,
  pago tardío y duplicado, cancelación, despacho con trazabilidad de lotes, eliminación de cuenta;
  funciones del panel (resumen por permisos, búsqueda de productos, vista de inventario, libro con
  responsable), regla de publicación con variante activa, permiso para archivar e
  **ingresos/ajustes idempotentes**; la lista de permisos compartida coincide con la tabla; cada
  código de error de negocio tiene mensaje en español.
- **Panel de punta a punta (6)**: una cuenta de cliente no accede; enrolamiento TOTP con código
  incorrecto y correcto; cookies de sesión `HttpOnly` e inaccesibles desde JavaScript; crear producto (validaciones), agregar variante (GTIN inválido rechazado,
  precio con IVA calculado), publicar, slug duplicado con mensaje claro y formulario conservado;
  crear bodega, ingreso, ajuste que dejaría stock negativo (rechazado), ajuste válido, saldos y
  libro con responsable; el rol de inventario consulta pero no edita el catálogo; cierre de sesión;
  verificación con factor ya activo.

### Defectos encontrados por las pruebas y corregidos

| Prueba | Defecto | Corrección |
|---|---|---|
| Revisión visual de la app | Sin conexión, las pantallas quedaban «Cargando…» más de 40 s: supabase-js reintentaba por su cuenta además de la app | Una sola capa de reintentos (TanStack Query), tiempo máximo por solicitud y estado «Sin conexión» con «Reintentar» |
| Revisión visual de la app | Etiquetas de la barra inferior recortadas | Alto de la barra según el área segura del dispositivo |
| Revisión visual de la app | Botón «Reintentar» descentrado y texto «Sin conexión» repetido | Ajuste del estado de error |
| Base de datos | La regla documentada «publicar exige una variante activa» no se aplicaba | Validación en la base (`NO_ACTIVE_VARIANT`) y prueba |
| Panel E2E | El aviso de «Producto publicado» desaparecía junto con el botón | Aviso en la página después de redirigir |
| Panel E2E | Tras un error, los selectores (bodega, categoría) perdían lo elegido | El formulario se vuelve a montar con los valores enviados |
| Panel (navegador) | El enlace de recuperación redirigía al host interno (`localhost`) | Redirecciones relativas |

## Pendiente de probar (requiere servicios o equipos que aún no existen)

- Contra un **proyecto Supabase real** (D-01): registro y verificación de correo, recuperación de
  contraseña, MFA real (TOTP), consultas de la app y del panel contra PostgREST, Storage y pg_cron.
- App en **dispositivos iOS y Android** reales (cámara, almacenamiento seguro, tamaños de pantalla,
  conectividad intermitente).
- **Pago real** en el ambiente de integración del proveedor aprobado (D-03).
- Respaldo y restauración probados (SEG-03).
