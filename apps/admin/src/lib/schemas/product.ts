import { PRODUCT_KIND_CODES, toGtin14, type ProductKind } from '@repo/domain';
import { z } from 'zod';

import { SLUG_PATTERN, slugify } from '@/lib/slug';

import { integer, optionalClp, optionalDecimal, optionalText, optionalUuid, requiredUuid } from './common';

export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

export const VARIANT_STATUSES = ['active', 'inactive', 'discontinued'] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const VARIANT_STATUS_LABELS: Record<VariantStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva (oculta)',
  discontinued: 'Descontinuada',
};

export const TAX_CLASS_LABELS = { iva: 'Afecto a IVA', exempt: 'Exento de IVA' } as const;

/** Datos del producto (sin estado: publicar o archivar son acciones aparte). */
export const productSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(200, 'Máximo 200 caracteres.'),
    slug: z.string().trim().toLowerCase().max(120, 'Máximo 120 caracteres.'),
    productKind: z.enum(PRODUCT_KIND_CODES as [ProductKind, ...ProductKind[]], 'Selecciona el tipo de producto.'),
    categoryId: requiredUuid('Selecciona una categoría.'),
    brandId: optionalUuid,
    manufacturerId: optionalUuid,
    implantSystemId: optionalUuid,
    shortDescription: optionalText(300, 'Descripción breve'),
    description: optionalText(20_000, 'Descripción'),
    usageInstructions: optionalText(20_000, 'Instrucciones de uso'),
    storageConditions: optionalText(2_000, 'Condiciones de almacenamiento'),
    taxClass: z.enum(['iva', 'exempt'], 'Selecciona el tratamiento tributario.'),
    tracksLots: z.boolean(),
    tracksExpiry: z.boolean(),
    requiresProfessional: z.boolean(),
    isFeatured: z.boolean(),
  })
  .transform((d) => ({ ...d, slug: d.slug === '' ? slugify(d.name) : d.slug }))
  .refine((d) => SLUG_PATTERN.test(d.slug), {
    path: ['slug'],
    error: 'Solo minúsculas, números y guiones (por ejemplo: implante-conico-4-0).',
  })
  .refine((d) => !d.tracksExpiry || d.tracksLots, {
    path: ['tracksExpiry'],
    error: 'Para controlar vencimientos, activa también el control de lotes.',
  });

export type ProductData = z.output<typeof productSchema>;

/** Fila para la tabla public.products. */
export function productRow(d: ProductData) {
  return {
    name: d.name,
    slug: d.slug,
    product_kind: d.productKind,
    category_id: d.categoryId,
    brand_id: d.brandId,
    manufacturer_id: d.manufacturerId,
    implant_system_id: d.implantSystemId,
    short_description: d.shortDescription,
    description: d.description,
    usage_instructions: d.usageInstructions,
    storage_conditions: d.storageConditions,
    tax_class: d.taxClass,
    tracks_lots: d.tracksLots,
    tracks_expiry: d.tracksExpiry,
    requires_professional: d.requiresProfessional,
    is_featured: d.isFeatured,
  };
}

/** GTIN-8/12/13/14 con dígito verificador válido; se guarda como GTIN-14. '' = sin GTIN. */
const gtinField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const digits = v.replace(/[\s-]/g, '');
    if (digits === '') return null;
    const gtin = toGtin14(digits);
    if (!gtin) {
      ctx.addIssue({ code: 'custom', message: 'GTIN no válido: revisa los dígitos (8, 12, 13 o 14) y el verificador.' });
      return z.NEVER;
    }
    return gtin;
  });

export const variantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, 'El SKU debe tener al menos 2 caracteres.')
    .max(64, 'Máximo 64 caracteres.')
    .regex(/^[A-Za-z0-9._\-/]+$/, 'El SKU admite letras, números, punto, guion, guion bajo y barra (sin espacios).'),
  manufacturerRef: optionalText(64, 'Código del fabricante'),
  gtin: gtinField,
  label: optionalText(120, 'Nombre de la variante'),
  diameterMm: optionalDecimal('Diámetro', { gt: 0, lt: 100 }),
  lengthMm: optionalDecimal('Largo', { gt: 0, lt: 1000 }),
  platformId: optionalUuid,
  connectionTypeId: optionalUuid,
  status: z.enum(VARIANT_STATUSES, 'Selecciona el estado.'),
  sortOrder: integer('Orden', { min: -1000, max: 1000 }),
  /** Precio neto de la lista base (solo con permiso prices.update). '' = no cambiar. */
  priceNet: optionalClp('Precio neto'),
});

export type VariantData = z.output<typeof variantSchema>;

export function variantRow(d: VariantData) {
  return {
    sku: d.sku,
    manufacturer_ref: d.manufacturerRef,
    gtin: d.gtin,
    label: d.label,
    diameter_mm: d.diameterMm,
    length_mm: d.lengthMm,
    platform_id: d.platformId,
    connection_type_id: d.connectionTypeId,
    status: d.status,
    sort_order: d.sortOrder,
  };
}

/** Lee el formulario de producto (los textos llegan como string; las casillas, como «on»). */
export function readProductForm(data: FormData) {
  const text = (name: string) => {
    const v = data.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    name: text('name'),
    slug: text('slug'),
    productKind: text('productKind'),
    categoryId: text('categoryId'),
    brandId: text('brandId'),
    manufacturerId: text('manufacturerId'),
    implantSystemId: text('implantSystemId'),
    shortDescription: text('shortDescription'),
    description: text('description'),
    usageInstructions: text('usageInstructions'),
    storageConditions: text('storageConditions'),
    taxClass: text('taxClass'),
    tracksLots: data.get('tracksLots') === 'on',
    tracksExpiry: data.get('tracksExpiry') === 'on',
    requiresProfessional: data.get('requiresProfessional') === 'on',
    isFeatured: data.get('isFeatured') === 'on',
  };
}

export function readVariantForm(data: FormData) {
  const text = (name: string) => {
    const v = data.get(name);
    return typeof v === 'string' ? v : '';
  };
  return {
    sku: text('sku'),
    manufacturerRef: text('manufacturerRef'),
    gtin: text('gtin'),
    label: text('label'),
    diameterMm: text('diameterMm'),
    lengthMm: text('lengthMm'),
    platformId: text('platformId'),
    connectionTypeId: text('connectionTypeId'),
    status: text('status'),
    sortOrder: text('sortOrder') || '0',
    priceNet: text('priceNet'),
  };
}
