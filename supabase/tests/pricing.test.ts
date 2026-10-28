/**
 * Paridad de cálculo entre SQL (autoridad) y TypeScript (visualización): mismos vectores.
 */
import { afterAll, describe, expect, it } from 'vitest';
import vectors from '@repo/domain/test-vectors/pricing.json';
import { computeTotals, type PricingInput } from '@repo/domain';
import { admin, pool } from './helpers/db';

afterAll(async () => {
  await pool.end();
});

type Case = (typeof vectors.cases)[number];

async function sqlTotals(c: Case) {
  const lines = c.input.lines.map((l) => ({
    unit_price_net: l.unitPriceNet,
    quantity: l.quantity,
    tax_class: l.taxClass,
  }));
  const [row] = await admin<{ t: Record<string, unknown> }>(
    `select private.compute_order_totals($1, $2::numeric, $3::jsonb, $4) as t`,
    [c.input.priceMode, c.input.taxRateBp / 10000, JSON.stringify(lines), c.input.shippingNet],
  );
  return row!.t as {
    subtotal_net: number; shipping_gross: number; taxable_net: number; exempt_net: number;
    tax_amount: number; total: number;
    lines: Array<{ unit_price_gross: number; line_net: number; line_gross: number; line_total: number }>;
  };
}

describe('private.compute_order_totals — vectores compartidos', () => {
  for (const c of vectors.cases) {
    it(c.name, async () => {
      const t = await sqlTotals(c);
      expect(t.subtotal_net).toBe(c.expected.subtotalNet);
      expect(t.shipping_gross).toBe(c.expected.shippingGross);
      expect(t.taxable_net).toBe(c.expected.taxableNet);
      expect(t.exempt_net).toBe(c.expected.exemptNet);
      expect(t.tax_amount).toBe(c.expected.taxAmount);
      expect(t.total).toBe(c.expected.total);
      c.expected.lines.forEach((l, i) => {
        expect(t.lines[i]).toMatchObject({
          unit_price_gross: l.unitPriceGross,
          line_net: l.lineNet,
          line_gross: l.lineGross,
          line_total: l.lineTotal,
        });
      });
    });
  }
});

describe('paridad SQL ↔ TypeScript en casos aleatorios', () => {
  it('500 carritos aleatorios dan el mismo total en ambos modos', async () => {
    let seed = 20261028;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };
    for (let n = 0; n < 500; n++) {
      const input: PricingInput = {
        priceMode: n % 2 === 0 ? 'gross' : 'net',
        taxRateBp: 1900,
        shippingNet: rand(3) === 0 ? 0 : rand(20000),
        lines: Array.from({ length: 1 + rand(5) }, () => ({
          unitPriceNet: 1 + rand(500000),
          quantity: 1 + rand(20),
          taxClass: rand(6) === 0 ? 'exempt' : 'iva',
        })),
      };
      const ts = computeTotals(input);
      const [row] = await admin<{ t: { total: number; tax_amount: number; taxable_net: number } }>(
        `select private.compute_order_totals($1, 0.19, $2::jsonb, $3) as t`,
        [input.priceMode,
         JSON.stringify(input.lines.map((l) => ({ unit_price_net: l.unitPriceNet, quantity: l.quantity, tax_class: l.taxClass }))),
         input.shippingNet],
      );
      expect({ total: row!.t.total, tax: row!.t.tax_amount, net: row!.t.taxable_net })
        .toEqual({ total: ts.total, tax: ts.taxAmount, net: ts.taxableNet });
    }
  });
});
