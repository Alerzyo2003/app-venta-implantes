/**
 * Funciones del panel administrativo: regla de publicación, resumen operativo, búsqueda de
 * productos para el personal, vista de inventario y libro de movimientos (migración 0900).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '@repo/domain';
import {
  admin,
  createAdmin,
  createCatalog,
  createUser,
  expectDbError,
  pool,
  query,
  receiveStock,
  roleCode,
  suffix,
  uid,
  type Actor,
  type CatalogFixture,
  type TestUser,
} from './helpers/db';

let cat: CatalogFixture;
let staff: TestUser;
let inventoryClerk: TestUser;
let customer: TestUser;
const anon: Actor = { kind: 'anon' };

beforeAll(async () => {
  cat = await createCatalog();
  staff = await createAdmin();
  inventoryClerk = await createUser({ fullName: 'Encargada de bodega', roles: ['inventario'] });
  customer = await createUser();
});

afterAll(async () => {
  await pool.end();
});

/** GTIN-13 (EAN-13) aleatorio con dígito verificador GS1 válido. */
function randomGtin13(): string {
  const body = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  const sum = [...body].reverse().reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return body + String((10 - (sum % 10)) % 10);
}

async function draftProduct(actor: Actor, name: string): Promise<string> {
  const tag = suffix();
  const [p] = await query<{ id: string }>(actor,
    `insert into public.products (category_id, product_kind, name, slug)
     values ($1, 'general_supply', $2, $3) returning id`,
    [cat.categoryId, `${name} ${tag}`, `producto-panel-${tag}`]);
  return p!.id;
}

describe('permisos', () => {
  it('la lista compartida de @repo/domain coincide con la tabla de permisos', async () => {
    const rows = await admin<{ code: string }>(`select code from public.permissions order by code`);
    expect(rows.map((r) => r.code)).toEqual([...PERMISSION_CODES].sort());
  });
});

describe('publicación', () => {
  it('no se publica un producto sin variantes activas', async () => {
    const id = await draftProduct(staff.actor, 'Insumo sin variantes');
    await expectDbError(query(staff.actor, `update public.products set status = 'published' where id = $1`, [id]),
      { message: 'NO_ACTIVE_VARIANT' });

    await query(staff.actor,
      `insert into public.product_variants (product_id, sku, status) values ($1, $2, 'inactive')`, [id, `INA-${suffix()}`]);
    await expectDbError(query(staff.actor, `update public.products set status = 'published' where id = $1`, [id]),
      { message: 'NO_ACTIVE_VARIANT' });

    await query(staff.actor, `insert into public.product_variants (product_id, sku) values ($1, $2)`, [id, `ACT-${suffix()}`]);
    const [p] = await query<{ status: string; published_at: string | null }>(staff.actor,
      `update public.products set status = 'published' where id = $1 returning status, published_at`, [id]);
    expect(p).toMatchObject({ status: 'published' });
    expect(p!.published_at).not.toBeNull();
  });

  it('archivar o restaurar exige el permiso catalog.delete', async () => {
    const role = roleCode('editor');
    await admin(`insert into public.roles (code, name) values ($1, 'Editor de prueba')`, [role]);
    await admin(`insert into public.role_permissions values ($1, 'catalog.read'), ($1, 'catalog.update')`, [role]);
    const editor = await createUser({ roles: [role] });
    const id = await draftProduct(staff.actor, 'Insumo para archivar');

    await expectDbError(query(editor.actor, `update public.products set status = 'archived' where id = $1`, [id]),
      { message: 'PERMISSION_DENIED' });
    await query(staff.actor, `update public.products set status = 'archived' where id = $1`, [id]);
    await expectDbError(query(editor.actor, `update public.products set status = 'draft' where id = $1`, [id]),
      { message: 'PERMISSION_DENIED' });
    // Editar otros datos de un producto archivado no cambia su estado: se permite con catalog.update.
    await query(editor.actor, `update public.products set short_description = 'Retirado del catálogo' where id = $1`, [id]);
  });

  it('tampoco se puede crear directamente como publicado desde la API', async () => {
    const tag = suffix();
    await expectDbError(query(staff.actor,
      `insert into public.products (category_id, product_kind, name, slug, status)
       values ($1, 'general_supply', $2, $3, 'published')`,
      [cat.categoryId, `Insumo directo ${tag}`, `insumo-directo-${tag}`]), { message: 'NO_ACTIVE_VARIANT' });
  });
});

describe('resumen operativo', () => {
  type Summary = {
    products?: { draft: number; published: number; archived: number; published_without_active_variant: number };
    inventory?: { out_of_stock: number; low_stock: number; low_stock_threshold: number; expiring_lots: number;
      expired_lots_with_stock: number; blocked_lots_with_stock: number; expiry_warning_days: number };
    orders?: Record<string, number>;
    pending_verifications?: number;
  };
  const summary = async (actor: Actor) =>
    (await query<{ s: Summary }>(actor, `select public.admin_dashboard_summary() as s`))[0]!.s;

  it('no está disponible para anónimos ni clientes', async () => {
    await expectDbError(query(anon, `select public.admin_dashboard_summary()`), { code: '42501' });
    await expectDbError(query(customer.actor, `select public.admin_dashboard_summary()`), { message: 'PERMISSION_DENIED' });
  });

  it('exige MFA al personal', async () => {
    const aal1: Actor = { kind: 'user', id: staff.id, aal: 'aal1' };
    await expectDbError(query(aal1, `select public.admin_dashboard_summary()`), { message: 'MFA_REQUIRED' });
  });

  it('cada rol ve solo las secciones de sus permisos', async () => {
    const full = await summary(staff.actor);
    expect(Object.keys(full).sort()).toEqual(['inventory', 'orders', 'pending_verifications', 'products']);
    const clerk = await summary(inventoryClerk.actor);
    // El rol de inventario no revisa verificaciones profesionales.
    expect(Object.keys(clerk).sort()).toEqual(['inventory', 'orders', 'products']);
  });

  it('refleja stock agotado, últimas unidades y lotes por vencer', async () => {
    const before = (await summary(staff.actor)).inventory!;
    const c = await createCatalog(); // 3 medidas de implante + 1 pilar publicados, sin stock
    const afterCreate = (await summary(staff.actor)).inventory!;
    expect(afterCreate.out_of_stock).toBe(before.out_of_stock + 4);

    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await receiveStock(staff.actor, c.implantVariants.d40l10, c.warehouseId, 2, { number: `L-${c.tag}`, expiry: soon });
    await receiveStock(staff.actor, c.abutmentVariantId, c.warehouseId, 50);
    const after = (await summary(staff.actor)).inventory!;
    expect(after.out_of_stock).toBe(before.out_of_stock + 2);
    expect(after.low_stock).toBe(before.low_stock + 1); // 2 unidades <= umbral (5)
    expect(after.expiring_lots).toBe(before.expiring_lots + 1);
  });

  it('cuenta productos por estado, incluidos los publicados sin variante activa', async () => {
    const before = (await summary(staff.actor)).products!;
    const id = await draftProduct(staff.actor, 'Borrador para resumen');
    const mid = (await summary(staff.actor)).products!;
    expect(mid.draft).toBe(before.draft + 1);

    // Publicado con variante activa que luego se desactiva: el resumen lo advierte.
    const [v] = await query<{ id: string }>(staff.actor,
      `insert into public.product_variants (product_id, sku) values ($1, $2) returning id`, [id, `RES-${suffix()}`]);
    await query(staff.actor, `update public.products set status = 'published' where id = $1`, [id]);
    await query(staff.actor, `update public.product_variants set status = 'discontinued' where id = $1`, [v!.id]);
    const after = (await summary(staff.actor)).products!;
    expect(after.published_without_active_variant).toBe(before.published_without_active_variant + 1);
  });
});

describe('búsqueda de productos del panel', () => {
  type Row = { id: string; name: string; status: string; variant_count: number; active_variant_count: number; total_count: number };
  const search = (actor: Actor, q: string | null, status: string | null = null, limit = 25) =>
    query<Row>(actor, `select * from public.admin_search_products($1, $2, null, $3, 0)`, [q, status, limit]);

  it('solo para personal con permiso de catálogo', async () => {
    await expectDbError(search(customer.actor, 'implante'), { message: 'PERMISSION_DENIED' });
    await expectDbError(query(anon, `select * from public.admin_search_products('x')`), { code: '42501' });
  });

  it('encuentra por nombre sin tildes, por código con símbolos y por GTIN', async () => {
    const byName = await search(staff.actor, `conico prueba ${cat.tag}`);
    expect(byName.map((r) => r.id)).toEqual([cat.implantProductId]);
    expect(byName[0]).toMatchObject({ variant_count: 3, active_variant_count: 3, total_count: 1 });

    const bySku = await search(staff.actor, `imp ${cat.tag}`);
    expect(bySku.map((r) => r.id)).toEqual([cat.implantProductId]);

    // La base guarda GTIN-14; el personal puede escanear o digitar el EAN-13 del envase.
    const ean13 = randomGtin13();
    await admin(`update public.product_variants set gtin = $2 where id = $1`, [cat.abutmentVariantId, `0${ean13}`]);
    expect((await search(staff.actor, ean13)).map((r) => r.id)).toEqual([cat.abutmentProductId]);
    expect((await search(staff.actor, `0${ean13}`)).map((r) => r.id)).toEqual([cat.abutmentProductId]);
  });

  it('incluye borradores y filtra por estado', async () => {
    const id = await draftProduct(staff.actor, `Gasa estéril ${cat.tag}`);
    expect((await search(staff.actor, `gasa esteril ${cat.tag}`)).map((r) => r.id)).toEqual([id]);
    expect(await search(staff.actor, `gasa esteril ${cat.tag}`, 'published')).toEqual([]);
    await expectDbError(search(staff.actor, null, 'borrado'), { message: 'INVALID_INPUT' });
  });

  it('los comodines del texto se tratan como literales', async () => {
    const rows = await search(staff.actor, '%');
    expect(rows.every((r) => r.name.includes('%'))).toBe(true);
    const underscore = await search(staff.actor, '_');
    expect(underscore.every((r) => r.name.includes('_'))).toBe(true);
  });

  it('pagina con total', async () => {
    const page = await search(staff.actor, `prueba ${cat.tag}`, null, 1);
    expect(page).toHaveLength(1);
    expect(page[0]!.total_count).toBe(2); // implante y pilar del mismo catálogo de prueba
  });
});

describe('inventario del panel', () => {
  type Row = { variant_id: string; on_hand: number; reserved: number; available: number; next_expiry: string | null;
    stock_status: string; total_count: number };
  const overview = (actor: Actor, q: string, warehouse: string | null = null, alertsOnly = false) =>
    query<Row>(actor,
      `select variant_id, on_hand, reserved, available, next_expiry::text as next_expiry, stock_status, total_count
         from public.admin_inventory_overview($1, $2, $3, 100, 0)`, [q, warehouse, alertsOnly]);

  it('solo para personal con permiso de inventario', async () => {
    await expectDbError(overview(customer.actor, 'x'), { message: 'PERMISSION_DENIED' });
  });

  it('muestra existencias, disponibilidad, próximo vencimiento y alertas', async () => {
    const c = await createCatalog();
    const expiry = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    await receiveStock(inventoryClerk.actor, c.implantVariants.d40l10, c.warehouseId, 12, { number: `A-${c.tag}`, expiry });
    await receiveStock(inventoryClerk.actor, c.implantVariants.d35l10, c.warehouseId, 3, { number: `B-${c.tag}`, expiry });

    const rows = await overview(inventoryClerk.actor, `prueba ${c.tag}`);
    expect(rows).toHaveLength(4);
    const byId = new Map(rows.map((r) => [r.variant_id, r]));
    expect(byId.get(c.implantVariants.d40l10)).toMatchObject({ on_hand: 12, available: 12, stock_status: 'in_stock', next_expiry: expiry });
    expect(byId.get(c.implantVariants.d35l10)).toMatchObject({ on_hand: 3, stock_status: 'low_stock' });
    expect(byId.get(c.implantVariants.d40l115)).toMatchObject({ on_hand: 0, stock_status: 'out_of_stock', next_expiry: null });

    const alerts = await overview(inventoryClerk.actor, `prueba ${c.tag}`, null, true);
    expect(alerts.map((r) => r.variant_id).sort()).toEqual(
      [c.implantVariants.d35l10, c.implantVariants.d40l115, c.abutmentVariantId].sort());

    // Filtrar por otra bodega deja los saldos en cero.
    const [other] = await admin<{ id: string }>(
      `insert into public.warehouses (code, name) values ($1, 'Otra bodega de prueba') returning id`, [`O${c.tag.toUpperCase()}`]);
    const inOther = await overview(inventoryClerk.actor, `prueba ${c.tag}`, other!.id);
    expect(inOther.every((r) => r.on_hand === 0 && r.available === 0)).toBe(true);
  });

  it('un reenvío del mismo ingreso o ajuste no duplica el movimiento', async () => {
    const c = await createCatalog();
    const requestId = uid();
    const receive = (qty: number, actor: Actor = inventoryClerk.actor) =>
      query<{ id: number }>(actor,
        `select public.inventory_receive($1, $2, $3, null, null, 'Ingreso con reintento', $4) as id`,
        [c.abutmentVariantId, c.warehouseId, qty, requestId]);
    const [first] = await receive(10);
    const [again] = await receive(10);
    expect(again!.id).toBe(first!.id);
    const [{ on_hand }] = (await admin<{ on_hand: number }>(
      `select on_hand from public.stock_balances where variant_id = $1 and warehouse_id = $2`,
      [c.abutmentVariantId, c.warehouseId])) as [{ on_hand: number }];
    expect(on_hand).toBe(10);

    // El mismo identificador con otra cantidad o desde otra cuenta no se acepta como reintento.
    await expectDbError(receive(12), { message: 'DUPLICATE_REQUEST' });
    await expectDbError(receive(10, staff.actor), { message: 'DUPLICATE_REQUEST' });

    const adjustId = uid();
    const adjust = () => query<{ id: number }>(inventoryClerk.actor,
      `select public.inventory_adjust($1, $2, -3, 'Merma', null, $3) as id`, [c.abutmentVariantId, c.warehouseId, adjustId]);
    const [a1] = await adjust();
    const [a2] = await adjust();
    expect(a2!.id).toBe(a1!.id);
    const movements = await admin<{ n: number }>(
      `select count(*)::int as n from public.stock_movements where variant_id = $1`, [c.abutmentVariantId]);
    expect(movements[0]!.n).toBe(2);

    // La tabla de solicitudes no es accesible desde la API.
    await expectDbError(query(inventoryClerk.actor, `select * from public.inventory_requests`), { code: '42501' });
  });

  it('el libro de movimientos indica quién registró cada movimiento', async () => {
    const c = await createCatalog();
    await receiveStock(inventoryClerk.actor, c.abutmentVariantId, c.warehouseId, 7);
    await query(inventoryClerk.actor, `select public.inventory_adjust($1, $2, -2, 'Unidades dañadas')`,
      [c.abutmentVariantId, c.warehouseId]);

    type Mov = { quantity: number; movement_type: string; reason: string | null; on_hand_after: number; actor_name: string | null; total_count: number };
    const movs = await query<Mov>(inventoryClerk.actor,
      `select * from public.admin_stock_movements($1, null, 50, 0)`, [c.abutmentVariantId]);
    expect(movs.map((m) => [m.movement_type, m.quantity, m.on_hand_after])).toEqual([
      ['adjustment', -2, 5],
      ['receipt', 7, 7],
    ]);
    expect(movs.every((m) => m.actor_name === 'Encargada de bodega')).toBe(true);
    expect(movs[0]!.total_count).toBe(2);

    await expectDbError(query(customer.actor, `select * from public.admin_stock_movements()`), { message: 'PERMISSION_DENIED' });
  });
});
