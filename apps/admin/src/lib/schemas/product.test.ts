import { describe, expect, it } from 'vitest';

import { productRow, productSchema, readProductForm, readVariantForm, variantRow, variantSchema } from './product';

const CATEGORY = '7d4a2c1e-3b5f-4c8a-9d2e-1f0a6b3c5d7e';

function productForm(overrides: Record<string, string | boolean> = {}) {
  const fd = new FormData();
  const values: Record<string, string | boolean> = {
    name: 'Implante Cónico Ø 4,0 × 10',
    slug: '',
    productKind: 'implant',
    categoryId: CATEGORY,
    brandId: '',
    manufacturerId: '',
    implantSystemId: '',
    shortDescription: '',
    description: '',
    usageInstructions: '',
    storageConditions: '',
    taxClass: 'iva',
    tracksLots: true,
    tracksExpiry: true,
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'boolean') {
      if (v) fd.set(k, 'on');
    } else fd.set(k, v);
  }
  return readProductForm(fd);
}

describe('productSchema', () => {
  it('genera la dirección web desde el nombre y guarda vacíos como null', () => {
    const r = productSchema.safeParse(productForm());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.slug).toBe('implante-conico-4-0-10');
    const row = productRow(r.data);
    expect(row).toMatchObject({ brand_id: null, short_description: null, tracks_lots: true, tracks_expiry: true, is_featured: false });
  });

  it('rechaza slugs con mayúsculas convertidas pero símbolos inválidos', () => {
    const r = productSchema.safeParse(productForm({ slug: 'mi producto!' }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['slug']);
    expect(productSchema.safeParse(productForm({ slug: 'Mi-Producto' })).success).toBe(true);
  });

  it('el vencimiento exige control de lotes', () => {
    const r = productSchema.safeParse(productForm({ tracksLots: false, tracksExpiry: true }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['tracksExpiry']);
  });

  it('exige categoría y tipo válidos', () => {
    const r = productSchema.safeParse(productForm({ categoryId: '', productKind: 'nave-espacial' }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('categoryId');
      expect(paths).toContain('productKind');
    }
  });
});

function variantForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values: Record<string, string> = {
    sku: 'IMP-4010',
    manufacturerRef: '',
    gtin: '',
    label: '',
    diameterMm: '',
    lengthMm: '',
    platformId: '',
    connectionTypeId: '',
    status: 'active',
    sortOrder: '',
    priceNet: '',
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return readVariantForm(fd);
}

describe('variantSchema', () => {
  it('acepta medidas con coma decimal y precio con separador de miles', () => {
    const r = variantSchema.safeParse(variantForm({ diameterMm: '4,1', lengthMm: '11.5', priceNet: '$89.990' }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ diameterMm: 4.1, lengthMm: 11.5, priceNet: 89990, sortOrder: 0 });
    expect(variantRow(r.data)).toMatchObject({ diameter_mm: 4.1, length_mm: 11.5, gtin: null });
  });

  it('normaliza el GTIN a 14 dígitos y valida el verificador', () => {
    const ok = variantSchema.safeParse(variantForm({ gtin: '4006381333931' }));
    expect(ok.success && ok.data.gtin).toBe('04006381333931');
    const bad = variantSchema.safeParse(variantForm({ gtin: '4006381333932' }));
    expect(bad.success).toBe(false);
  });

  it('rechaza SKU con espacios, medidas fuera de rango y precios no enteros', () => {
    const r = variantSchema.safeParse(variantForm({ sku: 'IMP 40', diameterMm: '0', lengthMm: 'diez', priceNet: '1.000,50' }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join('.')).sort()).toEqual(['diameterMm', 'lengthMm', 'priceNet', 'sku']);
    }
  });

  it('precio vacío = no cambiar; cero no es un precio válido', () => {
    expect(variantSchema.safeParse(variantForm()).success && variantSchema.parse(variantForm()).priceNet).toBe(null);
    expect(variantSchema.safeParse(variantForm({ priceNet: '0' })).success).toBe(false);
  });
});
