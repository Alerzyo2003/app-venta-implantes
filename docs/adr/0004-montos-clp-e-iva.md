# ADR-0004 · Montos en CLP enteros y reglas de IVA

- **Estado**: Aceptada. Los valores por defecto están sujetos a D-04 — 2026-10-28

## Contexto
El CLP no usa decimales. Las facturas (B2B) desglosan el neto y el IVA; las boletas (consumidor) muestran el total con IVA. Mostrar un precio unitario con IVA redondeado y luego calcular el total desde los netos puede generar diferencias de $1, inaceptables para un consumidor.

## Decisión
- Todos los montos de venta se guardan como enteros (`bigint`) en CLP. Los precios de lista se guardan **netos**.
- Tasa de IVA configurable (`tax.iva_rate`, por defecto 0,19). Cada pedido guarda la tasa aplicada. Redondeo **half-up** al peso.
- `precio_bruto_unitario = redondeo(neto × (1 + tasa))` para los productos afectos.
- **Modo factura** (`price_mode = net`):
  - `neto_afecto = Σ neto_línea_afecta + despacho_neto`
  - `IVA = redondeo(neto_afecto × tasa)`
  - `total = neto_afecto + neto_exento + IVA`
- **Modo boleta** (`price_mode = gross`):
  - `bruto_línea = bruto_unitario × cantidad`
  - `despacho_bruto = redondeo(despacho_neto × (1 + tasa))`
  - `total = Σ bruto_línea_afecta + despacho_bruto + Σ neto_exento`
  - `neto_afecto = redondeo(total_afecto / (1 + tasa))`
  - `IVA = total_afecto − neto_afecto`
- La autoridad es la función SQL `private.compute_order_totals`. `packages/domain/src/pricing.ts` replica las reglas para la visualización. Ambas se prueban con los mismos vectores (`packages/domain/test-vectors/pricing.json`).

## Consecuencias
- Lo que el consumidor ve suma exactamente lo que paga.
- Un mismo carrito puede diferir en $1 entre la boleta y la factura. Es correcto, porque cada documento aplica su regla.
