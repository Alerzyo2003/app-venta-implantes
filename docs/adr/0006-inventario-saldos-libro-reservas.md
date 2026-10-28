# ADR-0006 · Inventario: saldos, libro de movimientos y reservas

- **Estado**: Aceptada — 2026-10-28

## Contexto
Se requiere stock físico, reservado, comprometido y disponible, varias bodegas, lotes con vencimiento, cero sobreventa y trazabilidad de lotes por pedido.

## Decisión
- `stock_balances` (variante × bodega) con `on_hand`, `reserved` y `committed`, y `CHECK (reserved + committed <= on_hand)` y valores no negativos.
- `lot_balances` (lote × bodega) para las variantes con lote. Las funciones mantienen Σ lotes = `on_hand`.
- `stock_movements` es un libro inmutable: cada cambio de `on_hand` genera un movimiento con su motivo y responsable.
- `stock_reservations` vincula pedido, variante y bodega. Ciclo: activa → comprometida → consumida, o liberada.
- Los lotes se asignan **al despachar** (FEFO por defecto o el lote escaneado) y quedan en `order_item_allocations`.
- Las filas de saldo se bloquean con `FOR UPDATE` en orden de `variant_id`.
- Los kits (F4) no tienen saldo: reservan sus componentes.

## Consecuencias
- Disponible = Σ bodegas habilitadas para la venta (`on_hand − reserved − committed`).
- Cambiar la política de stock negativo exigiría una migración explícita (D-12).
