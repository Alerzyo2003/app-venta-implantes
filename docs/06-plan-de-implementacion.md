# Plan de implementación y MVP

Versión 0.1 — 2026-10-28. El avance real se registra en [08-estado-de-avance.md](08-estado-de-avance.md).

## 1. Definición del MVP

Primera versión funcional (especificación, sección 47) que permite:

1. Registrar clientes (con verificación de correo y consentimientos).
2. Explorar implantes y productos (catálogo, buscador y filtros).
3. Consultar compatibilidades **verificadas**.
4. Comprar: carrito y checkout con precios, IVA, stock y despacho calculados en el servidor.
5. Pagar mediante una **integración real** (proveedor según [D-03](07-decisiones-pendientes.md)).
6. Consultar los pedidos desde cualquier dispositivo.
7. Administrar productos e inventario desde el panel, con permisos y auditoría.

Fuera del MVP (fases posteriores): cotizaciones, kits, clínicas con aprobación, promociones y cupones, compras recurrentes, proveedores y órdenes de compra, alertas, CRM, soporte, devoluciones, BI, tienda web y fidelización.

## 2. Incrementos del MVP

Cada incremento termina con una entrega verificable: pruebas automatizadas en verde, documentación actualizada y la forma de probarlo.

| Inc. | Contenido | Criterios de aceptación | Depende de |
|---|---|---|---|
| **0** | Fase 1 (documentación) + cimientos: monorepo, `packages/domain` probado, esquema base con RLS, RPC transaccionales, pruebas de base de datos, base de la app móvil (identidad, navegación y componentes) y del panel | Pruebas de dominio y de base de datos ejecutadas y documentadas. Las apps compilan (typecheck, lint, bundle) | — |
| **1** | Cuentas y catálogo de punta a punta: registro, login, recuperación, perfil, direcciones, facturación y consentimientos. Catálogo, búsqueda y ficha con compatibilidades verificadas. Panel: catálogo, compatibilidades, precios e importación CSV | Criterios 1, 4 y 5 de la sección 46 verificados contra un proyecto Supabase real | [D-01](07-decisiones-pendientes.md), [D-02](07-decisiones-pendientes.md), [D-08](07-decisiones-pendientes.md) |
| **2** | Inventario: bodegas, ingreso, ajuste, lotes y vencimientos, movimientos y disponibilidad en el catálogo | Movimientos auditados, sin stock negativo y disponibilidad coherente en la app | Inc. 1 |
| **3** | Carrito y pedidos: cotización del servidor, checkout, `place_order` idempotente con reserva y vencimiento, historial y cancelación. Despacho manual con tarifas por comuna | Criterios 2, 3 y 6. Prueba de concurrencia sin sobreventa | Inc. 2, [D-05](07-decisiones-pendientes.md), [D-13](07-decisiones-pendientes.md) |
| **4** | Pago real: Edge Function con adaptador del proveedor aprobado, confirmación servidor a servidor, eventos idempotentes, pago tardío y comprobante. Correo de confirmación | Criterio 7 probado en el ambiente de integración del proveedor | [D-03](07-decisiones-pendientes.md), red con acceso al proveedor |
| **5** | Endurecimiento: MFA del personal, auditoría visible en el panel, eliminación de cuenta, monitoreo, respaldos y restauración probados, builds de preview en EAS | Criterio 18. Lista de seguridad completa | [D-09](07-decisiones-pendientes.md), [D-11](07-decisiones-pendientes.md) |

## 3. Fases posteriores (especificación, sección 45)

| Fase | Contenido |
|---|---|
| **F4** Compras y cotizaciones (post-MVP) | Cotizaciones PDF y su conversión en pedido; kits y armador; listas y procedimientos; comprar nuevamente; pedidos programados; clínicas con roles y aprobación; promociones, cupones y listas de precios por cliente; comparador; alternativas comerciales |
| **F5** Backend e inventario avanzado | Proveedores, costos históricos, órdenes de compra con aprobación, recepción con escáner, transferencias entre bodegas y conteos |
| **F6** Operación comercial | Reembolsos y conciliación, facturación electrónica, integración con transportistas, notificaciones (push, correo y WhatsApp Business), CRM, carritos abandonados, soporte, devoluciones con cuarentena y alertas |
| **F7** Inteligencia comercial | Indicadores con fórmulas documentadas, rentabilidad, reportes y exportaciones, pronóstico con nivel de confianza, OC sugeridas, metas, calendario, calculadora de costos, fidelización y opiniones |
| **F8** Panel completo y tienda web | Tienda Next.js sincronizada (SEO, compra), completitud del panel |
| **F9** Pruebas y publicación | Pruebas E2E en dispositivos (iOS y Android, tamaños y conectividad), corrección de errores, builds productivos, fichas de las tiendas, envío a revisión |

> La numeración de fases sigue la especificación. Las fases 2, 3 y 5 se reparten entre los incrementos del MVP porque el MVP necesita partes de cada una.

## 4. Definición de terminado (por funcionalidad)

- Implementada en el backend (RLS y RPC) y en el cliente, sin botones sin función.
- Pruebas automatizadas de las reglas críticas en verde, con el resultado registrado en [10-pruebas.md](10-pruebas.md).
- Estados de carga, error, vacío y sin conexión implementados.
- Documentación actualizada (requisitos, estado de avance y, si aplica, ADR).
- Sin errores críticos conocidos abiertos.

## 5. Estrategia de pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarias de dominio | Vitest | Dinero e IVA, RUT, parser de búsqueda, GS1, máquinas de estado |
| Base de datos | Vitest + `pg` sobre PostgreSQL con emulación de los roles de Supabase | RLS (aislamiento entre usuarios y por rol), RPC transaccionales, idempotencia, concurrencia y auditoría |
| Integración con la API | supabase-js contra un proyecto Supabase de desarrollo o el CLI local | Auth real (registro, verificación, login), llamadas RPC con JWT reales |
| Componentes | Jest + Testing Library (React Native) | Componentes y formularios críticos |
| E2E móvil | Maestro o Detox en simuladores y dispositivos (F9) | Flujos de compra completos |
| E2E web | Playwright | Panel y tienda |

## 6. Riesgos del plan

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Decisiones comerciales pendientes | Bloquean los incrementos 1, 3 y 4 | Se trabajan primero los componentes independientes. Cada decisión trae una recomendación concreta |
| Sin proyecto Supabase para pruebas reales | No se puede validar Auth ni PostgREST de punta a punta | Pruebas de base de datos locales. Crear un proyecto de desarrollo ([D-01](07-decisiones-pendientes.md)) |
| Sin acceso de red a los proveedores desde el entorno de desarrollo | No se puede probar el pago aquí | Probar desde un entorno con acceso (CI o local del equipo) |
| Contenido legal pendiente | Impide producción | Asesoría legal ([D-14](07-decisiones-pendientes.md)) |
