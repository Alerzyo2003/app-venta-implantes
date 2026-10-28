# Matriz de roles y permisos

Versión 0.1 — 2026-10-28. La fuente de verdad ejecutable son las tablas `roles`, `permissions` y `role_permissions` (semilla en `supabase/seed.sql`, administrables desde el panel con `users.manage_roles`).

## 1. Modelo

- **Permiso** = `recurso.acción`. Acciones: `read` (consultar), `create` (crear), `update` (modificar), `approve` (aprobar), `delete` (eliminar o archivar), además de acciones específicas (`publish`, `verify`, `import`, `export`, `adjust`, `receive`…).
- **Rol interno** = conjunto de permisos. Un usuario puede tener varios roles; los permisos se suman.
- **Cliente** = cualquier usuario autenticado sin rol interno. Accede solo a sus propios datos mediante RLS (`user_id = auth.uid()`).
- **Roles de clínica** (F4) = permisos dentro de una organización, guardados en `organization_members.role`.

### 1.1 Capas de aplicación

1. **RLS**: decide qué filas se ven o modifican. Ejemplo: `orders` solo es visible para su dueño o para quien tiene `orders.read`.
2. **Funciones RPC**: verifican `private.has_permission('…')` antes de operar (inventario, cambios de estado, roles) y validan las reglas de negocio.
3. **Privilegios por columna**: el cliente solo puede actualizar sus columnas personales en `profiles`, no su estado de verificación.
4. **Interfaz**: oculta lo que no corresponde, **solo por usabilidad**.

### 1.2 MFA del personal

Si `security.require_staff_mfa = true` (valor por defecto), `has_permission()` devuelve falso cuando la sesión del personal no tiene `aal2` (segundo factor verificado). El panel obliga a enrolar TOTP antes de operar.

## 2. Roles internos

| Código | Rol | Descripción |
|---|---|---|
| `admin_general` | Administrador general | Todos los permisos, incluidos los roles, la configuración y la auditoría. |
| `admin_comercial` | Administrador comercial | Catálogo, precios, compatibilidades, clientes, pedidos, promociones y reportes comerciales. |
| `vendedor` | Vendedor | Clientes, cotizaciones, CRM y consulta de catálogo, stock y pedidos. |
| `inventario` | Encargado de inventario | Stock, lotes, bodegas, ajustes y recepción de mercadería. |
| `despacho` | Encargado de despacho | Preparación, despacho, envíos y seguimiento. |
| `compras` | Responsable de compras | Proveedores, costos y órdenes de compra (crear y recibir; aprobar no). |
| `soporte` | Soporte | Tickets, devoluciones y consulta de clientes y pedidos. |

## 3. Matriz (personal interno)

Leyenda: **R** consultar · **C** crear · **U** modificar · **A** aprobar o verificar · **D** eliminar o archivar · **X** exportar · `—` sin acceso. Las columnas usan los códigos de rol de la tabla anterior.

| Recurso | admin_general | admin_comercial | vendedor | inventario | despacho | compras | soporte |
|---|---|---|---|---|---|---|---|
| Catálogo (productos, variantes, categorías, marcas…) | RCUDX + publicar + importar | RCUDX + publicar + importar | R | R | R | R | R |
| Compatibilidades | RCUA | RCUA | R | R | — | R | R |
| Precios de venta | RU | RU | R | — | — | R | — |
| Costos de adquisición | RU | R | — | — | — | RU | — |
| Inventario y movimientos | R + ajustar + recibir | R | R | R + ajustar + recibir + lotes | R | R | R |
| Bodegas | RCUD | R | — | RCU | R | R | — |
| Proveedores (F5) | RCUD | R | — | R | — | RCU | — |
| Órdenes de compra (F5) | RCUA | RA | — | R + recibir | — | RC + recibir | — |
| Pedidos | RUX + cancelar | RUX + cancelar | R | R | RU (preparación y despacho) | — | R |
| Pagos | R + A (transferencias) | R | — | — | — | — | R |
| Reembolsos (F6) | RCA | RC | — | — | — | — | RC |
| Despachos y envíos | RCU | R | R | R | RCU | — | R |
| Clientes y organizaciones | RUX | RUX | R | — | R | — | R |
| Verificación profesional | RA | RA | R | — | — | — | R |
| Cotizaciones (F4) | RCUA | RCUA | RCU | — | — | — | R |
| Promociones y listas de precios (F4) | RCUD | RCUD | — | — | — | — | — |
| CRM (F6) | RCUD | RCUD | RCU | — | — | — | R |
| Soporte (F6) | RCUD | R | R | — | R | — | RCU |
| Devoluciones (F6) | RCUA | RCUA | R | RU (inspección) | RU | — | RCU |
| Reportes operativos (F7) | RX | RX | R (propios) | R (inventario) | R (despacho) | R (compras) | R (soporte) |
| Reportes financieros, márgenes y comisiones (F7) | RX | RX | — | — | — | — | — |
| Configuración | RU | R | — | — | — | — | — |
| Usuarios y roles | RCUD | — | — | — | — | — | — |
| Auditoría | R | — | — | — | — | — | — |

## 4. Códigos de permiso (MVP)

| Código | Uso |
|---|---|
| `catalog.read` · `catalog.create` · `catalog.update` · `catalog.delete` · `catalog.publish` · `catalog.import` · `catalog.export` | Catálogo y referencias |
| `compatibility.read` · `compatibility.manage` · `compatibility.verify` | Compatibilidades (verificar exige evidencia) |
| `prices.read` · `prices.update` | Listas de precios |
| `costs.read` · `costs.update` | Costos (información sensible) |
| `inventory.read` · `inventory.adjust` · `inventory.receive` · `inventory.lots` | Inventario |
| `warehouses.manage` | Bodegas |
| `orders.read` · `orders.update` · `orders.cancel` · `orders.export` | Pedidos |
| `payments.read` · `payments.approve` | Pagos (`approve` = confirmación manual de transferencias) |
| `refunds.create` · `refunds.approve` | Reembolsos |
| `shipments.read` · `shipments.update` | Envíos |
| `customers.read` · `customers.update` · `customers.export` | Clientes |
| `verifications.review` | Verificación profesional |
| `organizations.read` · `organizations.manage` | Organizaciones |
| `settings.read` · `settings.update` | Configuración |
| `users.read` · `users.manage_roles` | Personal y roles |
| `audit.read` | Auditoría |

Los permisos de las fases posteriores (`quotes.*`, `promotions.*`, `suppliers.*`, `purchase_orders.*`, `crm.*`, `support.*`, `returns.*`, `reports.*`, `goals.*`, `commissions.read`) se agregan con sus módulos.

## 5. Clientes y clínicas

| Acción | Cliente (propio) | Admin. de clínica (F4) | Usuario de clínica (F4) |
|---|---|---|---|
| Ver y editar el perfil propio | ✔ | ✔ | ✔ |
| Direcciones y facturación propias | CRUD | CRUD (también las de la clínica) | R (las de la clínica) |
| Carrito y favoritos | CRUD propios | CRUD propios | CRUD propios |
| Crear pedidos | ✔ (si cumple la verificación requerida) | ✔ | Según el rol: el encargado de compras compra; el asistente solicita aprobación |
| Ver pedidos | Propios | Todos los de la clínica | Propios (y los de la clínica si el rol lo permite) |
| Aprobar solicitudes de compra | — | ✔ | — |
| Gestionar miembros | — | ✔ | — |
| Ver precios especiales | Los asignados | Los de la clínica | Los de la clínica |

## 6. Auditoría obligatoria

Se registran en `audit_log` (solo inserción, sin columnas sensibles): cambios de precio, de costo, movimientos de stock (además del libro de movimientos), cambios de estado de pedidos, pagos y reembolsos, compatibilidades verificadas o rechazadas, asignación y retiro de roles, cambios de configuración, revisión de verificaciones profesionales y exportaciones sensibles (F7).
