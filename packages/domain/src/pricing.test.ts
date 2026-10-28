import { describe, expect, it } from 'vitest';
import vectors from '../test-vectors/pricing.json';
import { computeTotals, grossFromNet, priceModeForDocument, type PricingInput } from './pricing';

describe('computeTotals — vectores compartidos con la base de datos', () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      const result = computeTotals(c.input as PricingInput);
      expect(result.subtotalNet).toBe(c.expected.subtotalNet);
      expect(result.shippingGross).toBe(c.expected.shippingGross);
      expect(result.taxableNet).toBe(c.expected.taxableNet);
      expect(result.exemptNet).toBe(c.expected.exemptNet);
      expect(result.taxAmount).toBe(c.expected.taxAmount);
      expect(result.total).toBe(c.expected.total);
      c.expected.lines.forEach((line, i) => {
        expect(result.lines[i]).toMatchObject(line);
      });
    });
  }
});

describe('invariantes', () => {
  it('en modo boleta el total es exactamente la suma de las líneas brutas más el despacho', () => {
    const r = computeTotals({
      priceMode: 'gross',
      taxRateBp: 1900,
      shippingNet: 3990,
      lines: [
        { unitPriceNet: 8403, quantity: 7, taxClass: 'iva' },
        { unitPriceNet: 15990, quantity: 1, taxClass: 'iva' },
      ],
    });
    const sumLines = r.lines.reduce((a, l) => a + l.lineTotal, 0);
    expect(r.total).toBe(sumLines + r.shippingGross);
    expect(r.taxableNet + r.taxAmount).toBe(r.total);
  });

  it('en modo factura total = neto afecto + exento + IVA', () => {
    const r = computeTotals({
      priceMode: 'net',
      taxRateBp: 1900,
      shippingNet: 0,
      lines: [
        { unitPriceNet: 1001, quantity: 3, taxClass: 'iva' },
        { unitPriceNet: 999, quantity: 2, taxClass: 'exempt' },
      ],
    });
    expect(r.total).toBe(r.taxableNet + r.exemptNet + r.taxAmount);
  });

  it('rechaza cantidades y montos inválidos', () => {
    const base = { priceMode: 'net' as const, taxRateBp: 1900, shippingNet: 0 };
    expect(() =>
      computeTotals({ ...base, lines: [{ unitPriceNet: 100, quantity: 0, taxClass: 'iva' }] }),
    ).toThrow();
    expect(() =>
      computeTotals({ ...base, lines: [{ unitPriceNet: -1, quantity: 1, taxClass: 'iva' }] }),
    ).toThrow();
    expect(() =>
      computeTotals({ ...base, lines: [{ unitPriceNet: 10.5, quantity: 1, taxClass: 'iva' }] }),
    ).toThrow();
    expect(() => computeTotals({ ...base, taxRateBp: 19, shippingNet: -5, lines: [] })).toThrow();
  });

  it('un carrito vacío totaliza solo el despacho', () => {
    const r = computeTotals({ priceMode: 'gross', taxRateBp: 1900, shippingNet: 1000, lines: [] });
    expect(r.total).toBe(1190);
  });
});

describe('grossFromNet', () => {
  it('aplica IVA a afectos y no a exentos', () => {
    expect(grossFromNet(10000, 1900)).toBe(11900);
    expect(grossFromNet(10000, 1900, 'exempt')).toBe(10000);
  });
});

describe('priceModeForDocument', () => {
  it('factura usa neto y boleta usa bruto', () => {
    expect(priceModeForDocument('factura')).toBe('net');
    expect(priceModeForDocument('boleta')).toBe('gross');
  });
});
