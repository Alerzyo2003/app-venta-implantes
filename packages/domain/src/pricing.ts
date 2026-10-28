/**
 * Cálculo de totales de un pedido según ADR-0004.
 *
 * IMPORTANTE: la autoridad es la función SQL `private.compute_order_totals`. Esta
 * implementación existe para mostrar estimaciones en los clientes y se prueba con los
 * mismos vectores (`test-vectors/pricing.json`) que la base de datos.
 */
import { assertAmount, divRoundHalfUp } from './money';

export type TaxClass = 'iva' | 'exempt';
/** net = documento factura (B2B); gross = documento boleta (consumidor). */
export type PriceMode = 'net' | 'gross';
export type DocumentType = 'boleta' | 'factura';

export const DEFAULT_IVA_BASIS_POINTS = 1900;

export function priceModeForDocument(documentType: DocumentType): PriceMode {
  return documentType === 'factura' ? 'net' : 'gross';
}

export interface PricingLineInput {
  unitPriceNet: number;
  quantity: number;
  taxClass: TaxClass;
  /** Descuento neto total de la línea (F4). Por defecto 0. */
  discountNet?: number;
}

export interface PricingInput {
  priceMode: PriceMode;
  /** Tasa de IVA en puntos base (1900 = 19 %). */
  taxRateBp: number;
  lines: PricingLineInput[];
  /** Costo de despacho neto (afecto a IVA). */
  shippingNet: number;
}

export interface PricingLineResult {
  unitPriceNet: number;
  unitPriceGross: number;
  quantity: number;
  taxClass: TaxClass;
  discountNet: number;
  lineNet: number;
  lineGross: number;
  /** Total que se muestra en la línea: neto en modo factura, bruto en modo boleta. */
  lineTotal: number;
}

export interface PricingResult {
  priceMode: PriceMode;
  taxRateBp: number;
  lines: PricingLineResult[];
  /** Suma de netos de línea (afectos + exentos), antes de despacho. */
  subtotalNet: number;
  discountNet: number;
  shippingNet: number;
  shippingGross: number;
  /** Base imponible (neto afecto, incluye despacho). */
  taxableNet: number;
  exemptNet: number;
  taxAmount: number;
  total: number;
}

/** Precio bruto unitario: redondeo(neto × (1 + tasa)). Exentos no cambian. */
export function grossFromNet(net: number, taxRateBp: number, taxClass: TaxClass = 'iva'): number {
  assertAmount(net, 'precio neto');
  if (taxClass === 'exempt') return net;
  return divRoundHalfUp(net * (10_000 + taxRateBp), 10_000);
}

export function computeTotals(input: PricingInput): PricingResult {
  const { priceMode, taxRateBp, shippingNet } = input;
  if (!Number.isInteger(taxRateBp) || taxRateBp < 0 || taxRateBp >= 10_000) {
    throw new RangeError(`Tasa de IVA inválida: ${taxRateBp} pb`);
  }
  assertAmount(shippingNet, 'despacho');

  const lines: PricingLineResult[] = input.lines.map((line, i) => {
    const discountNet = line.discountNet ?? 0;
    assertAmount(line.unitPriceNet, `precio de la línea ${i + 1}`);
    assertAmount(discountNet, `descuento de la línea ${i + 1}`);
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`Cantidad inválida en la línea ${i + 1}: ${line.quantity}`);
    }
    const unitPriceGross = grossFromNet(line.unitPriceNet, taxRateBp, line.taxClass);
    const lineNet = line.unitPriceNet * line.quantity - discountNet;
    const discountGross = grossFromNet(discountNet, taxRateBp, line.taxClass);
    const lineGross = unitPriceGross * line.quantity - discountGross;
    if (lineNet < 0 || lineGross < 0) {
      throw new RangeError(`El descuento supera el total de la línea ${i + 1}`);
    }
    return {
      unitPriceNet: line.unitPriceNet,
      unitPriceGross,
      quantity: line.quantity,
      taxClass: line.taxClass,
      discountNet,
      lineNet,
      lineGross,
      lineTotal: priceMode === 'net' ? lineNet : lineGross,
    };
  });

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const taxable = lines.filter((l) => l.taxClass === 'iva');
  const exempt = lines.filter((l) => l.taxClass === 'exempt');

  const subtotalNet = sum(lines.map((l) => l.lineNet));
  const discountNet = sum(lines.map((l) => l.discountNet));
  const exemptNet = sum(exempt.map((l) => l.lineNet));
  const shippingGross = grossFromNet(shippingNet, taxRateBp, 'iva');

  if (priceMode === 'net') {
    const taxableNet = sum(taxable.map((l) => l.lineNet)) + shippingNet;
    const taxAmount = divRoundHalfUp(taxableNet * taxRateBp, 10_000);
    return {
      priceMode,
      taxRateBp,
      lines,
      subtotalNet,
      discountNet,
      shippingNet,
      shippingGross,
      taxableNet,
      exemptNet,
      taxAmount,
      total: taxableNet + exemptNet + taxAmount,
    };
  }

  const taxableGross = sum(taxable.map((l) => l.lineGross)) + shippingGross;
  const taxableNet = divRoundHalfUp(taxableGross * 10_000, 10_000 + taxRateBp);
  return {
    priceMode,
    taxRateBp,
    lines,
    subtotalNet,
    discountNet,
    shippingNet,
    shippingGross,
    taxableNet,
    exemptNet,
    taxAmount: taxableGross - taxableNet,
    total: taxableGross + exemptNet,
  };
}
