import 'server-only';

import type { ProductKind } from '@repo/domain';
import { z } from 'zod';

import { can } from '@/lib/auth/access';
import type { StaffContext } from '@/lib/auth/dal';
import type { ProductStatus, VariantStatus } from '@/lib/schemas/product';

export const isUuid = (value: string) => z.uuid().safeParse(value).success;

export interface ProductListRow {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  product_kind: ProductKind;
  category_name: string;
  brand_name: string | null;
  variant_count: number;
  active_variant_count: number;
  updated_at: string;
  total_count: number;
}

export async function searchProducts(
  ctx: StaffContext,
  filters: { query: string; status: ProductStatus | null; categoryId: string | null; limit: number; offset: number },
): Promise<{ rows: ProductListRow[]; total: number }> {
  const { data, error } = await ctx.supabase.rpc('admin_search_products', {
    p_query: filters.query || null,
    p_status: filters.status,
    p_category_id: filters.categoryId,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as ProductListRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export interface RefOption {
  id: string;
  name: string;
  is_active: boolean;
}
export interface PlatformOption extends RefOption {
  code: string;
  implant_system_id: string;
}
export interface SystemOption extends RefOption {
  manufacturer_id: string;
}
export interface CategoryOption extends RefOption {
  parent_id: string | null;
  sort_order: number;
}

export interface CatalogReferences {
  categories: CategoryOption[];
  brands: RefOption[];
  manufacturers: RefOption[];
  systems: SystemOption[];
  platforms: PlatformOption[];
  connectionTypes: RefOption[];
}

/** Datos de referencia para los formularios del catálogo (el personal ve también los inactivos). */
export async function getCatalogReferences(ctx: StaffContext): Promise<CatalogReferences> {
  const db = ctx.supabase;
  const [categories, brands, manufacturers, systems, platforms, connectionTypes] = await Promise.all([
    db.from('categories').select('id, name, is_active, parent_id, sort_order').order('sort_order').order('name'),
    db.from('brands').select('id, name, is_active').order('name'),
    db.from('manufacturers').select('id, name, is_active').order('name'),
    db.from('implant_systems').select('id, name, is_active, manufacturer_id').order('name'),
    db.from('platforms').select('id, name, code, is_active, implant_system_id').order('code'),
    db.from('connection_types').select('id, name, is_active').order('name'),
  ]);
  for (const r of [categories, brands, manufacturers, systems, platforms, connectionTypes]) {
    if (r.error) throw r.error;
  }
  return {
    categories: (categories.data ?? []) as CategoryOption[],
    brands: (brands.data ?? []) as RefOption[],
    manufacturers: (manufacturers.data ?? []) as RefOption[],
    systems: (systems.data ?? []) as SystemOption[],
    platforms: (platforms.data ?? []) as PlatformOption[],
    connectionTypes: (connectionTypes.data ?? []) as RefOption[],
  };
}

export interface ProductDetail {
  id: string;
  category_id: string;
  brand_id: string | null;
  manufacturer_id: string | null;
  implant_system_id: string | null;
  product_kind: ProductKind;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  usage_instructions: string | null;
  storage_conditions: string | null;
  tax_class: 'iva' | 'exempt';
  tracks_lots: boolean;
  tracks_expiry: boolean;
  requires_professional: boolean;
  status: ProductStatus;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProduct(ctx: StaffContext, id: string): Promise<ProductDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await ctx.supabase
    .from('products')
    .select(
      'id, category_id, brand_id, manufacturer_id, implant_system_id, product_kind, name, slug, short_description, ' +
        'description, usage_instructions, storage_conditions, tax_class, tracks_lots, tracks_expiry, ' +
        'requires_professional, status, is_featured, published_at, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ProductDetail | null;
}

export interface VariantDetail {
  id: string;
  product_id: string;
  sku: string;
  manufacturer_ref: string | null;
  gtin: string | null;
  label: string | null;
  diameter_mm: number | null;
  length_mm: number | null;
  platform_id: string | null;
  connection_type_id: string | null;
  status: VariantStatus;
  sort_order: number;
}

const VARIANT_COLUMNS =
  'id, product_id, sku, manufacturer_ref, gtin, label, diameter_mm, length_mm, platform_id, connection_type_id, status, sort_order';

function normalizeVariant(v: VariantDetail): VariantDetail {
  // PostgREST entrega numeric como número o texto según el valor: se normaliza a número.
  return {
    ...v,
    diameter_mm: v.diameter_mm == null ? null : Number(v.diameter_mm),
    length_mm: v.length_mm == null ? null : Number(v.length_mm),
  };
}

export async function getVariants(ctx: StaffContext, productId: string): Promise<VariantDetail[]> {
  const { data, error } = await ctx.supabase
    .from('product_variants')
    .select(VARIANT_COLUMNS)
    .eq('product_id', productId)
    .order('sort_order')
    .order('sku');
  if (error) throw error;
  return ((data ?? []) as unknown as VariantDetail[]).map(normalizeVariant);
}

export async function getVariant(ctx: StaffContext, productId: string, variantId: string): Promise<VariantDetail | null> {
  if (!isUuid(variantId)) return null;
  const { data, error } = await ctx.supabase
    .from('product_variants')
    .select(VARIANT_COLUMNS)
    .eq('id', variantId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeVariant(data as unknown as VariantDetail) : null;
}

/** Precio neto unitario (desde 1 unidad) de la lista base. Vacío si el usuario no ve precios. */
export async function getBasePrices(ctx: StaffContext, variantIds: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (!can(ctx, 'prices.read') || variantIds.length === 0) return prices;
  const { data: list, error: listError } = await ctx.supabase
    .from('price_lists')
    .select('id')
    .eq('is_default', true)
    .maybeSingle();
  if (listError) throw listError;
  if (!list) return prices;
  const { data, error } = await ctx.supabase
    .from('price_list_items')
    .select('variant_id, unit_price_net')
    .eq('price_list_id', (list as { id: string }).id)
    .eq('min_quantity', 1)
    .in('variant_id', variantIds);
  if (error) throw error;
  for (const row of (data ?? []) as { variant_id: string; unit_price_net: number }[]) {
    prices.set(row.variant_id, Number(row.unit_price_net));
  }
  return prices;
}

/** Tasa de IVA vigente en puntos base (configuración pública tax.iva_rate). */
export async function getIvaRateBp(ctx: StaffContext): Promise<number> {
  const { data, error } = await ctx.supabase.from('app_settings').select('value').eq('key', 'tax.iva_rate').maybeSingle();
  if (error) throw error;
  const rate = Number((data as { value: unknown } | null)?.value ?? 0.19);
  return Math.round((Number.isFinite(rate) ? rate : 0.19) * 10_000);
}

export async function getCategories(ctx: StaffContext): Promise<CategoryOption[]> {
  const { data, error } = await ctx.supabase
    .from('categories')
    .select('id, name, is_active, parent_id, sort_order')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data ?? []) as CategoryOption[];
}
