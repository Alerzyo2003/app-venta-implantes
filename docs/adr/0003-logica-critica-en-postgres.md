# ADR-0003 · Operaciones críticas en PostgreSQL; integraciones en Edge Functions

- **Estado**: Aceptada — 2026-10-28

## Contexto
Los precios, el stock, los pedidos y los pagos deben validarse en el servidor, de forma transaccional e idempotente (principios P-04 y P-07).

## Decisión
- Las operaciones que modifican datos sensibles son **funciones PostgreSQL** (`security definer`, `search_path` fijo), con verificación explícita de permisos (`private.has_permission`) y bloqueos por fila. Ejemplos: `place_order`, `apply_payment_result`, `inventory_receive`, `inventory_adjust`, `fulfill_order`.
- Los roles de API (`anon`, `authenticated`) **no tienen** privilegios de escritura directa sobre las tablas sensibles.
- Las llamadas a servicios externos con secretos (pagos, DTE, transportistas, correo) se hacen desde **Edge Functions**, que luego invocan funciones SQL con el rol `service_role`.

## Alternativas
- Toda la lógica en un servidor de aplicación (Node): habría que coordinar las transacciones fuera de la base. Más infraestructura.
- Toda la lógica en Edge Functions: requeriría transacciones distribuidas y es más difícil garantizar la atomicidad del stock.

## Consecuencias
- Las funciones SQL deben ser pequeñas y estar cubiertas por pruebas (`supabase/tests`).
- Los errores de negocio se devuelven con códigos estables (`OUT_OF_STOCK`, `PRICE_CHANGED`…), que `packages/domain` traduce a mensajes en español.
