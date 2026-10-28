/**
 * Catálogo, visibilidad, búsqueda (BUS-01..05), precios visibles y auditoría (CAT-07, CAT-08, PRC-03).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseSearchQuery } from '@repo/domain';
import {
  admin,
  createAdmin,
  createCatalog,
  createUser,
  expectDbError,
  pool,
  query,
  roleCode,
  setSetting,
  type Actor,
  type CatalogFixture,
  type TestUser,
} from './helpers/db';

let cat: CatalogFixture;
let customer: TestUser;
let staff: TestUser;
const anon: Actor = { kind: 'anon' };

type SearchRow = {
  product_id: string;
  name: string;
  matched_variant_ids: string[];
  price_visible: boolean;
  min_price_net: number | null;
  min_price_gross: number | null;
  availability: string;
  total_count: number;
};

function search(actor: Actor, args: Record<string, unknown>) {
  const keys = Object.keys(args);
  const sql = `select * from public.search_catalog(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
  return query<SearchRow>(actor, sql, keys.map((k) => args[k]));
}

beforeAll(async () => {
  cat = await createCatalog();
  customer = await createUser();
  staff = await createAdmin();
});

afterAll(async () => {
  await pool.end();
});

describe('visibilidad del catálogo', () => {
  it('anónimos ven productos publicados pero no borradores', async () => {
    const [draft] = await admin<{ id: string }>(
      `insert into public.products (category_id, product_kind, name, slug, status)
       values ($1, 'general_supply', 'Borrador de prueba ${cat.tag}', 'borrador-prueba-${cat.tag}', 'draft') returning id`,
      [cat.categoryId]);
    const visible = await query(anon, `select id from public.products where id = any($1)`, [[cat.implantProductId, draft!.id]]);
    expect(visible.map((r) => r.id)).toEqual([cat.implantProductId]);
    const staffView = await query(staff.actor, `select id from public.products where id = $1`, [draft!.id]);
    expect(staffView).toHaveLength(1);
  });

  it('con catalog.visibility = authenticated, los anónimos no ven productos', async () => {
    await setSetting('catalog.visibility', 'authenticated');
    try {
      expect(await query(anon, `select id from public.products where id = $1`, [cat.implantProductId])).toEqual([]);
      expect(await query(customer.actor, `select id from public.products where id = $1`, [cat.implantProductId])).toHaveLength(1);
    } finally {
      await setSetting('catalog.visibility', 'public');
    }
  });

  it('las variantes inactivas no se muestran a clientes', async () => {
    await admin(`update public.product_variants set status = 'inactive' where id = $1`, [cat.implantVariants.d35l10]);
    try {
      const rows = await query(anon, `select id from public.product_variants where product_id = $1`, [cat.implantProductId]);
      expect(rows.map((r) => r.id)).not.toContain(cat.implantVariants.d35l10);
      expect(rows).toHaveLength(2);
    } finally {
      await admin(`update public.product_variants set status = 'active' where id = $1`, [cat.implantVariants.d35l10]);
    }
  });

  it('los clientes no pueden crear ni modificar productos', async () => {
    await expectDbError(
      query(customer.actor,
        `insert into public.products (category_id, product_kind, name, slug) values ($1, 'other', 'X', 'x-${cat.tag}')`,
        [cat.categoryId]),
      { code: '42501' });
    const rows = await query(customer.actor, `update public.products set name = 'Hack' where id = $1 returning id`, [cat.implantProductId]);
    expect(rows).toEqual([]);
  });
});

describe('administración del catálogo', () => {
  it('publicar exige el permiso catalog.publish', async () => {
    // Rol de prueba que puede crear y editar, pero no publicar.
    const role = roleCode('editor');
    await admin(`insert into public.roles (code, name) values ($1, 'Editor de prueba')`, [role]);
    await admin(`insert into public.role_permissions values ($1, 'catalog.create'), ($1, 'catalog.read'), ($1, 'catalog.update')`, [role]);
    const editor = await createUser({ roles: [role] });

    await expectDbError(
      query(editor.actor,
        `insert into public.products (category_id, product_kind, name, slug, status)
         values ($1, 'general_supply', 'Guantes prueba', 'guantes-prueba-${cat.tag}', 'published')`, [cat.categoryId]),
      { message: 'PERMISSION_DENIED' });

    const [p] = await query<{ id: string }>(editor.actor,
      `insert into public.products (category_id, product_kind, name, slug)
       values ($1, 'general_supply', 'Guantes prueba', 'guantes-prueba-${cat.tag}') returning id`, [cat.categoryId]);
    // Publicar exige además una variante activa (migración 0900).
    await query(editor.actor, `insert into public.product_variants (product_id, sku) values ($1, $2)`,
      [p!.id, `GUA-${cat.tag}`]);
    await expectDbError(
      query(editor.actor, `update public.products set status = 'published' where id = $1`, [p!.id]),
      { message: 'PERMISSION_DENIED' });

    await query(staff.actor, `update public.products set status = 'published' where id = $1`, [p!.id]);
    const [row] = await admin<{ published_at: Date | null; updated_by: string }>(
      `select published_at, updated_by from public.products where id = $1`, [p!.id]);
    expect(row!.published_at).not.toBeNull();
    expect(row!.updated_by).toBe(staff.id);
  });

  it('detecta SKU duplicados sin distinguir mayúsculas (CAT-07)', async () => {
    const sku = `IMP-${cat.tag}-4010`.toLowerCase();
    await expectDbError(
      query(staff.actor, `insert into public.product_variants (product_id, sku) values ($1, $2)`, [cat.implantProductId, sku]),
      { code: '23505' });
  });

  it('rechaza GTIN con dígito verificador inválido y acepta uno válido', async () => {
    await expectDbError(
      query(staff.actor, `update public.product_variants set gtin = '04006381333932' where id = $1`, [cat.abutmentVariantId]),
      { code: '23514' });
    await query(staff.actor, `update public.product_variants set gtin = '04006381333931' where id = $1`, [cat.abutmentVariantId]);
  });

  it('registra el historial de cambios de precio con autor (PRC-03)', async () => {
    const [base] = await admin<{ id: string }>(`select id from public.price_lists where code = 'base'`);
    await query(staff.actor,
      `update public.price_list_items set unit_price_net = 92990 where price_list_id = $1 and variant_id = $2`,
      [base!.id, cat.implantVariants.d40l10]);
    const [log] = await admin<{ actor_id: string; old_data: { unit_price_net: number }; new_data: { unit_price_net: number } }>(
      `select actor_id, old_data, new_data from public.audit_log
        where table_name = 'price_list_items' and action = 'UPDATE' and record_id = $1
        order by id desc limit 1`,
      [`${base!.id}:${cat.implantVariants.d40l10}:1`]);
    expect(log!.actor_id).toBe(staff.id);
    expect(log!.old_data.unit_price_net).toBe(89990);
    expect(log!.new_data.unit_price_net).toBe(92990);
    await query(staff.actor,
      `update public.price_list_items set unit_price_net = 89990 where price_list_id = $1 and variant_id = $2`,
      [base!.id, cat.implantVariants.d40l10]);
  });
});

describe('precios visibles según configuración', () => {
  it('anónimos no ven precios con pricing.visibility = authenticated', async () => {
    const rows = await query<{ price_visible: boolean; unit_price_net: number | null }>(anon,
      `select price_visible, unit_price_net from public.get_variant_prices($1)`, [[cat.implantVariants.d40l10]]);
    expect(rows).toEqual([{ price_visible: false, unit_price_net: null }]);
  });

  it('usuarios autenticados ven precio neto y bruto con IVA', async () => {
    const [r] = await query<{ unit_price_net: number; unit_price_gross: number }>(customer.actor,
      `select unit_price_net, unit_price_gross from public.get_variant_prices($1)`, [[cat.implantVariants.d40l10]]);
    expect(r).toEqual({ unit_price_net: 89990, unit_price_gross: 107088 });
  });

  it('con verified_professionals, solo los verificados ven precios', async () => {
    await setSetting('pricing.visibility', 'verified_professionals');
    try {
      const pro = await createUser({ professionalVerified: true });
      const [a] = await query<{ price_visible: boolean }>(customer.actor,
        `select price_visible from public.get_variant_prices($1)`, [[cat.implantVariants.d40l10]]);
      const [b] = await query<{ price_visible: boolean }>(pro.actor,
        `select price_visible from public.get_variant_prices($1)`, [[cat.implantVariants.d40l10]]);
      expect([a!.price_visible, b!.price_visible]).toEqual([false, true]);
    } finally {
      await setSetting('pricing.visibility', 'authenticated');
    }
  });

  it('los costos solo los ve quien tiene costs.read', async () => {
    await query(staff.actor, `insert into public.variant_costs (variant_id, unit_cost, cost_currency, exchange_rate) values ($1, 52.5, 'USD', 950)`,
      [cat.implantVariants.d40l10]);
    const [c] = await query<{ unit_cost_clp: number }>(staff.actor, `select unit_cost_clp from public.variant_costs where variant_id = $1`,
      [cat.implantVariants.d40l10]);
    expect(c!.unit_cost_clp).toBe(49875);
    expect(await query(customer.actor, `select 1 from public.variant_costs`)).toEqual([]);
    const seller = await createUser({ roles: ['vendedor'] });
    expect(await query(seller.actor, `select 1 from public.variant_costs`)).toEqual([]);
  });
});

describe('buscador (BUS)', () => {
  it('interpreta "implante de 4.0 x 10 mm" y devuelve la medida exacta', async () => {
    const parsed = parseSearchQuery('implante de 4.0 x 10 mm');
    const rows = await search(customer.actor, {
      p_query: parsed.text,
      p_diameter_mm: parsed.diameterMm,
      p_length_mm: parsed.lengthMm,
      p_brand_ids: [cat.brandId],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.product_id).toBe(cat.implantProductId);
    expect(rows[0]!.matched_variant_ids).toEqual([cat.implantVariants.d40l10]);
  });

  it('filtra por diámetro sin longitud (dos medidas coinciden)', async () => {
    const rows = await search(customer.actor, { p_diameter_mm: 4, p_brand_ids: [cat.brandId] });
    expect(rows[0]!.matched_variant_ids.sort()).toEqual([cat.implantVariants.d40l10, cat.implantVariants.d40l115].sort());
  });

  it('busca por código ignorando separadores y mayúsculas (BUS-03)', async () => {
    const code = parseSearchQuery(`imp ${cat.tag} 40115`).codeCandidate;
    const rows = await search(customer.actor, { p_code: code });
    expect(rows.map((r) => r.product_id)).toEqual([cat.implantProductId]);
    expect(rows[0]!.matched_variant_ids).toEqual([cat.implantVariants.d40l115]);
  });

  it('busca por referencia del fabricante', async () => {
    const rows = await search(customer.actor, { p_code: `ref.imp-${cat.tag}-3510` });
    expect(rows[0]!.matched_variant_ids).toEqual([cat.implantVariants.d35l10]);
  });

  it('tolera errores de escritura y tildes (BUS-05)', async () => {
    const rows = await search(customer.actor, { p_query: `implnte conico prueba ${cat.tag}` });
    expect(rows.map((r) => r.product_id)).toContain(cat.implantProductId);
    const rows2 = await search(customer.actor, { p_query: `CÓNICO ${cat.tag}` });
    expect(rows2.map((r) => r.product_id)).toContain(cat.implantProductId);
  });

  it('busca por marca y por sistema', async () => {
    const byBrand = await search(customer.actor, { p_query: `marca prueba ${cat.tag}` });
    expect(byBrand.map((r) => r.product_id)).toEqual(expect.arrayContaining([cat.implantProductId, cat.abutmentProductId]));
    const bySystem = await search(customer.actor, { p_system_ids: [cat.systemId], p_product_kinds: ['abutment'] });
    expect(bySystem.map((r) => r.product_id)).toEqual([cat.abutmentProductId]);
  });

  it('filtra por categoría incluyendo subcategorías', async () => {
    const [sub] = await admin<{ id: string }>(
      `insert into public.categories (parent_id, slug, name) values ($1, 'sub-${cat.tag}', 'Sub prueba') returning id`, [cat.categoryId]);
    const [p] = await admin<{ id: string }>(
      `insert into public.products (category_id, product_kind, name, slug, status, brand_id)
       values ($1, 'implant', 'Implante Sub ${cat.tag}', 'implante-sub-${cat.tag}', 'published', $2) returning id`, [sub!.id, cat.brandId]);
    const rows = await search(customer.actor, { p_category_id: cat.categoryId, p_brand_ids: [cat.brandId] });
    expect(rows.map((r) => r.product_id)).toEqual(expect.arrayContaining([cat.implantProductId, p!.id]));
  });

  it('muestra precio mínimo solo si el usuario puede ver precios, y pagina con total', async () => {
    const anonRows = await search(anon, { p_brand_ids: [cat.brandId], p_product_kinds: ['implant'], p_limit: 1 });
    expect(anonRows[0]!.price_visible).toBe(false);
    expect(anonRows[0]!.min_price_net).toBeNull();
    expect(anonRows[0]!.total_count).toBeGreaterThanOrEqual(1);
    const rows = await search(customer.actor, { p_code: `IMP-${cat.tag}-3510` });
    expect(rows[0]!.min_price_net).toBe(84990);
    expect(rows[0]!.min_price_gross).toBe(101138);
  });

  it('sin stock la disponibilidad es "out_of_stock" y el filtro de stock lo excluye', async () => {
    const rows = await search(customer.actor, { p_brand_ids: [cat.brandId], p_product_kinds: ['abutment'] });
    expect(rows[0]!.availability).toBe('out_of_stock');
    const inStock = await search(customer.actor, { p_brand_ids: [cat.brandId], p_product_kinds: ['abutment'], p_in_stock_only: true });
    expect(inStock).toEqual([]);
  });

  it('sugerencias mientras se escribe', async () => {
    const rows = await query<{ suggestion: string; kind: string }>(customer.actor,
      `select * from public.search_suggestions($1)`, [`Pilar Recto Prueba ${cat.tag}`.slice(0, 18)]);
    expect(rows.some((r) => r.kind === 'product')).toBe(true);
  });
});
