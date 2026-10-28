/**
 * Inventario: ingresos, ajustes, lotes y vencimientos, libro de movimientos y disponibilidad
 * (INV-01..04, ADR-0006).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admin,
  createAdmin,
  createCatalog,
  createUser,
  expectDbError,
  pool,
  query,
  receiveStock,
  type CatalogFixture,
  type TestUser,
} from './helpers/db';

let cat: CatalogFixture;
let staff: TestUser;
let customer: TestUser;

beforeAll(async () => {
  cat = await createCatalog();
  staff = await createAdmin();
  customer = await createUser();
});

afterAll(async () => {
  await pool.end();
});

const balance = async (variantId: string) => {
  const [b] = await admin<{ on_hand: number; reserved: number; committed: number }>(
    `select on_hand, reserved, committed from public.stock_balances where variant_id = $1 and warehouse_id = $2`,
    [variantId, cat.warehouseId]);
  return b;
};

const availability = async (variantId: string) => {
  const [a] = await query<{ status: string; available_qty: number | null }>(customer.actor,
    `select status, available_qty from public.get_availability($1)`, [[variantId]]);
  return a;
};

describe('ingresos y lotes', () => {
  it('un cliente no puede ingresar stock', async () => {
    await expectDbError(
      query(customer.actor, `select public.inventory_receive($1, $2, 10)`, [cat.abutmentVariantId, cat.warehouseId]),
      { message: 'PERMISSION_DENIED' });
  });

  it('producto con lote: exige número de lote y vencimiento', async () => {
    await expectDbError(receiveStock(staff.actor, cat.implantVariants.d40l10, cat.warehouseId, 5), { message: 'LOT_REQUIRED' });
    await expectDbError(
      receiveStock(staff.actor, cat.implantVariants.d40l10, cat.warehouseId, 5, { number: 'L-A' }),
      { message: 'EXPIRY_REQUIRED' });
  });

  it('registra lote, saldos y movimiento con el saldo resultante', async () => {
    await receiveStock(staff.actor, cat.implantVariants.d40l10, cat.warehouseId, 5, { number: 'L-A', expiry: '2030-01-31' });
    await receiveStock(staff.actor, cat.implantVariants.d40l10, cat.warehouseId, 3, { number: 'L-B', expiry: '2029-06-30' });
    expect(await balance(cat.implantVariants.d40l10)).toEqual({ on_hand: 8, reserved: 0, committed: 0 });
    const lots = await admin<{ lot_number: string; on_hand: number }>(
      `select l.lot_number, lb.on_hand from public.inventory_lots l join public.lot_balances lb on lb.lot_id = l.id
        where l.variant_id = $1 order by l.lot_number`, [cat.implantVariants.d40l10]);
    expect(lots).toEqual([{ lot_number: 'L-A', on_hand: 5 }, { lot_number: 'L-B', on_hand: 3 }]);
    const movements = await admin<{ quantity: number; movement_type: string; on_hand_after: number; actor_id: string }>(
      `select quantity, movement_type, on_hand_after, actor_id from public.stock_movements where variant_id = $1 order by id`,
      [cat.implantVariants.d40l10]);
    expect(movements.map((m) => [m.quantity, m.movement_type, m.on_hand_after])).toEqual([[5, 'receipt', 5], [3, 'receipt', 8]]);
    expect(movements.every((m) => m.actor_id === staff.id)).toBe(true);
  });

  it('un lote existente no admite otro vencimiento', async () => {
    await expectDbError(
      receiveStock(staff.actor, cat.implantVariants.d40l10, cat.warehouseId, 1, { number: 'L-A', expiry: '2031-01-31' }),
      { message: 'LOT_EXPIRY_MISMATCH' });
  });

  it('producto sin lote: ingreso directo', async () => {
    await receiveStock(staff.actor, cat.abutmentVariantId, cat.warehouseId, 12);
    expect(await balance(cat.abutmentVariantId)).toEqual({ on_hand: 12, reserved: 0, committed: 0 });
  });
});

describe('ajustes', () => {
  it('exige motivo', async () => {
    await expectDbError(
      query(staff.actor, `select public.inventory_adjust($1, $2, -1, '  ')`, [cat.abutmentVariantId, cat.warehouseId]),
      { message: 'REASON_REQUIRED' });
  });

  it('no permite stock negativo (INV-03)', async () => {
    await expectDbError(
      query(staff.actor, `select public.inventory_adjust($1, $2, -13, 'Conteo físico')`, [cat.abutmentVariantId, cat.warehouseId]),
      { message: 'INSUFFICIENT_STOCK' });
    expect((await balance(cat.abutmentVariantId))!.on_hand).toBe(12);
  });

  it('ajuste negativo válido con motivo queda en el libro', async () => {
    await query(staff.actor, `select public.inventory_adjust($1, $2, -2, 'Producto dañado en bodega')`, [cat.abutmentVariantId, cat.warehouseId]);
    expect((await balance(cat.abutmentVariantId))!.on_hand).toBe(10);
    const [m] = await admin<{ reason: string; quantity: number }>(
      `select reason, quantity from public.stock_movements where variant_id = $1 order by id desc limit 1`, [cat.abutmentVariantId]);
    expect(m).toEqual({ reason: 'Producto dañado en bodega', quantity: -2 });
  });

  it('variantes con lote exigen indicar el lote en el ajuste', async () => {
    await expectDbError(
      query(staff.actor, `select public.inventory_adjust($1, $2, -1, 'Conteo')`, [cat.implantVariants.d40l10, cat.warehouseId]),
      { message: 'LOT_REQUIRED' });
  });

  it('el libro de movimientos es inmutable para todos los roles de la API', async () => {
    await expectDbError(query(staff.actor, `update public.stock_movements set quantity = 100`), { code: '42501' });
    await expectDbError(query(staff.actor, `delete from public.stock_movements`), { code: '42501' });
    await expectDbError(query(staff.actor, `update public.stock_balances set on_hand = 999`), { code: '42501' });
  });
});

describe('disponibilidad', () => {
  it('suma de lotes = stock físico', async () => {
    const [r] = await admin<{ lots: number; on_hand: number }>(
      `select (select sum(lb.on_hand) from public.lot_balances lb join public.inventory_lots l on l.id = lb.lot_id
                where l.variant_id = $1)::int as lots,
              (select on_hand from public.stock_balances where variant_id = $1) as on_hand`,
      [cat.implantVariants.d40l10]);
    expect(r!.lots).toBe(r!.on_hand);
  });

  it('estado para el cliente: disponible / últimas unidades / agotado', async () => {
    expect(await availability(cat.abutmentVariantId)).toEqual({ status: 'in_stock', available_qty: null });
    expect(await availability(cat.implantVariants.d35l10)).toEqual({ status: 'out_of_stock', available_qty: 0 });
    await query(staff.actor, `select public.inventory_adjust($1, $2, -6, 'Prueba de umbral')`, [cat.abutmentVariantId, cat.warehouseId]);
    expect(await availability(cat.abutmentVariantId)).toEqual({ status: 'low_stock', available_qty: 4 });
  });

  it('el personal ve la cantidad exacta', async () => {
    const [a] = await query<{ available_qty: number }>(staff.actor, `select available_qty from public.get_availability($1)`,
      [[cat.implantVariants.d40l10]]);
    expect(a!.available_qty).toBe(8);
  });

  it('un lote en cuarentena no se vende; el cambio queda auditado con motivo', async () => {
    const [lot] = await admin<{ id: string }>(`select id from public.inventory_lots where variant_id = $1 and lot_number = 'L-B'`,
      [cat.implantVariants.d40l10]);
    await query(staff.actor, `select public.set_lot_status($1, 'quarantine', 'Alerta de calidad del fabricante')`, [lot!.id]);
    const [a] = await query<{ available_qty: number }>(staff.actor, `select available_qty from public.get_availability($1)`,
      [[cat.implantVariants.d40l10]]);
    expect(a!.available_qty).toBe(5);
    const [log] = await admin<{ context: { reason: string } }>(
      `select context from public.audit_log where action = 'lot.status_change' and record_id = $1`, [lot!.id]);
    expect(log!.context.reason).toBe('Alerta de calidad del fabricante');
    await query(staff.actor, `select public.set_lot_status($1, 'available', 'Liberado tras inspección')`, [lot!.id]);
  });

  it('un lote vencido no se vende aunque su estado no se haya actualizado', async () => {
    await receiveStock(staff.actor, cat.implantVariants.d40l115, cat.warehouseId, 4, { number: 'L-VENCIDO', expiry: '2020-01-31' });
    expect(await availability(cat.implantVariants.d40l115)).toEqual({ status: 'out_of_stock', available_qty: 0 });
  });
});
