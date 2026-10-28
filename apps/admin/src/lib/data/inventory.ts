import 'server-only';

import type { StaffContext } from '@/lib/auth/dal';
import { isUuid } from '@/lib/data/catalog';
import type { LotStatus, StockStatus } from '@/lib/schemas/inventory';
import type { ProductStatus, VariantStatus } from '@/lib/schemas/product';

export interface InventoryRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_status: ProductStatus;
  sku: string;
  variant_label: string | null;
  variant_status: VariantStatus;
  tracks_lots: boolean;
  tracks_expiry: boolean;
  on_hand: number;
  reserved: number;
  committed: number;
  available: number;
  next_expiry: string | null;
  stock_status: StockStatus;
  total_count: number;
}

export async function inventoryOverview(
  ctx: StaffContext,
  filters: { query: string; warehouseId: string | null; alertsOnly: boolean; limit: number; offset: number },
): Promise<{ rows: InventoryRow[]; total: number }> {
  const { data, error } = await ctx.supabase.rpc('admin_inventory_overview', {
    p_query: filters.query || null,
    p_warehouse_id: filters.warehouseId,
    p_alerts_only: filters.alertsOnly,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as InventoryRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address_line: string | null;
  comuna_code: string | null;
  is_active: boolean;
  is_sellable: boolean;
  is_pickup_point: boolean;
  priority: number;
  comuna: { name: string } | null;
}

const WAREHOUSE_COLUMNS =
  'id, code, name, address_line, comuna_code, is_active, is_sellable, is_pickup_point, priority, comuna:comunas(name)';

export async function getWarehouses(ctx: StaffContext): Promise<Warehouse[]> {
  const { data, error } = await ctx.supabase.from('warehouses').select(WAREHOUSE_COLUMNS).order('priority').order('code');
  if (error) throw error;
  return (data ?? []) as unknown as Warehouse[];
}

export async function getWarehouse(ctx: StaffContext, id: string): Promise<Warehouse | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await ctx.supabase.from('warehouses').select(WAREHOUSE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as Warehouse | null;
}

export interface VariantInventory {
  variant: {
    id: string;
    sku: string;
    label: string | null;
    status: VariantStatus;
    product: { id: string; name: string; status: ProductStatus; tracks_lots: boolean; tracks_expiry: boolean };
  };
  balances: {
    warehouse_id: string;
    on_hand: number;
    reserved: number;
    committed: number;
    updated_at: string;
    warehouse: { code: string; name: string; is_active: boolean; is_sellable: boolean };
  }[];
  lots: {
    id: string;
    lot_number: string;
    expiry_date: string | null;
    status: LotStatus;
    received_at: string;
    notes: string | null;
    lot_balances: { warehouse_id: string; on_hand: number; location: string | null }[];
  }[];
}

export async function getVariantInventory(ctx: StaffContext, variantId: string): Promise<VariantInventory | null> {
  if (!isUuid(variantId)) return null;
  const db = ctx.supabase;
  const { data: variant, error } = await db
    .from('product_variants')
    .select('id, sku, label, status, product:products(id, name, status, tracks_lots, tracks_expiry)')
    .eq('id', variantId)
    .maybeSingle();
  if (error) throw error;
  if (!variant) return null;

  const [balances, lots] = await Promise.all([
    db
      .from('stock_balances')
      .select('warehouse_id, on_hand, reserved, committed, updated_at, warehouse:warehouses(code, name, is_active, is_sellable)')
      .eq('variant_id', variantId),
    db
      .from('inventory_lots')
      .select('id, lot_number, expiry_date, status, received_at, notes, lot_balances(warehouse_id, on_hand, location)')
      .eq('variant_id', variantId)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('received_at', { ascending: false }),
  ]);
  if (balances.error) throw balances.error;
  if (lots.error) throw lots.error;
  return {
    variant: variant as unknown as VariantInventory['variant'],
    balances: (balances.data ?? []) as unknown as VariantInventory['balances'],
    lots: (lots.data ?? []) as unknown as VariantInventory['lots'],
  };
}

export interface MovementRow {
  id: number;
  occurred_at: string;
  variant_id: string;
  sku: string;
  product_name: string;
  warehouse_code: string;
  lot_number: string | null;
  quantity: number;
  movement_type: string;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  on_hand_after: number;
  actor_name: string | null;
  total_count: number;
}

export async function getMovements(
  ctx: StaffContext,
  filters: { variantId: string | null; warehouseId: string | null; limit: number; offset: number },
): Promise<{ rows: MovementRow[]; total: number }> {
  const { data, error } = await ctx.supabase.rpc('admin_stock_movements', {
    p_variant_id: filters.variantId,
    p_warehouse_id: filters.warehouseId,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as MovementRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export interface Territory {
  regions: { code: string; name: string; ordinal: number }[];
  comunas: { code: string; name: string; region_code: string }[];
}

export async function getTerritory(ctx: StaffContext): Promise<Territory> {
  const [regions, comunas] = await Promise.all([
    ctx.supabase.from('regions').select('code, name, ordinal').order('ordinal'),
    ctx.supabase.from('comunas').select('code, name, region_code').order('name'),
  ]);
  if (regions.error) throw regions.error;
  if (comunas.error) throw comunas.error;
  return { regions: regions.data as Territory['regions'], comunas: comunas.data as Territory['comunas'] };
}
