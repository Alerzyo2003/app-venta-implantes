/**
 * Compatibilidad explícita con evidencia (CMP-01..03, ADR-0005).
 * Criterio de aceptación 5: la compatibilidad usa información verificada.
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
  roleCode,
  type Actor,
  type CatalogFixture,
  type TestUser,
} from './helpers/db';

let cat: CatalogFixture;
let staff: TestUser;
let manager: TestUser;
let customer: TestUser;
let documentId: string;
const anon: Actor = { kind: 'anon' };

beforeAll(async () => {
  cat = await createCatalog();
  staff = await createAdmin();
  customer = await createUser();
  // Rol con 'compatibility.manage' pero sin 'compatibility.verify'.
  const role = roleCode('compat');
  await admin(`insert into public.roles (code, name) values ($1, 'Gestor de compatibilidades (prueba)')`, [role]);
  await admin(`insert into public.role_permissions values ($1, 'compatibility.manage'), ($1, 'compatibility.read')`, [role]);
  manager = await createUser({ roles: [role] });
  const [doc] = await admin<{ id: string }>(
    `insert into public.documents (kind, title, external_url, visibility, manufacturer_id)
     values ('compatibility_chart', 'Tabla de compatibilidad (prueba)', 'https://example.invalid/tabla.pdf', 'public', $1) returning id`,
    [cat.manufacturerId]);
  documentId = doc!.id;
});

afterAll(async () => {
  await pool.end();
});

const getComponents = (actor: Actor, variantId: string) =>
  query<{ component_product_id: string; implant_scope: string; evidence_type: string; verified_at: Date }>(actor,
    `select * from public.get_compatible_components($1)`, [variantId]);

const check = async (actor: Actor, implant: string, component: string) => {
  const [r] = await query<{ v: string }>(actor, `select public.check_compatibility($1, $2) as v`, [implant, component]);
  return r!.v;
};

describe('compatibilidades', () => {
  it('sin vínculo verificado, la compatibilidad está pendiente de verificación', async () => {
    expect(await getComponents(customer.actor, cat.implantVariants.d40l10)).toEqual([]);
    expect(await check(customer.actor, cat.implantVariants.d40l10, cat.abutmentVariantId)).toBe('unverified');
  });

  it('un vínculo pendiente no es visible para clientes, sí para el personal', async () => {
    const [link] = await query<{ id: string }>(manager.actor,
      `insert into public.compatibility_links (implant_scope, platform_id, component_product_id, notes)
       values ('platform', $1, $2, 'Pendiente de revisión') returning id`, [cat.platformId, cat.abutmentProductId]);
    expect(await query(customer.actor, `select id from public.compatibility_links where id = $1`, [link!.id])).toEqual([]);
    expect(await query(anon, `select id from public.compatibility_links where id = $1`, [link!.id])).toEqual([]);
    expect(await query(manager.actor, `select id from public.compatibility_links where id = $1`, [link!.id])).toHaveLength(1);
    expect(await check(customer.actor, cat.implantVariants.d40l10, cat.abutmentVariantId)).toBe('unverified');
  });

  it('no se puede verificar sin evidencia (fuente, fecha y responsable)', async () => {
    const [link] = await admin<{ id: string }>(`select id from public.compatibility_links where component_product_id = $1`, [cat.abutmentProductId]);
    await expectDbError(
      query(staff.actor, `update public.compatibility_links set status = 'verified' where id = $1`, [link!.id]),
      { message: 'EVIDENCE_REQUIRED' });
  });

  it('quien no tiene compatibility.verify no puede verificar', async () => {
    const [link] = await admin<{ id: string }>(`select id from public.compatibility_links where component_product_id = $1`, [cat.abutmentProductId]);
    await expectDbError(
      query(manager.actor,
        `update public.compatibility_links set status = 'verified', evidence_type = 'manufacturer_catalog', evidence_document_id = $2
          where id = $1`, [link!.id, documentId]),
      { message: 'PERMISSION_DENIED' });
  });

  it('verificado con evidencia: visible para todos y aplica a todas las medidas de la plataforma', async () => {
    const [link] = await admin<{ id: string }>(`select id from public.compatibility_links where component_product_id = $1`, [cat.abutmentProductId]);
    await query(staff.actor,
      `update public.compatibility_links
          set status = 'verified', evidence_type = 'manufacturer_catalog', evidence_document_id = $2,
              evidence_reference = 'Catálogo 2026, pág. 14'
        where id = $1`, [link!.id, documentId]);
    const [row] = await admin<{ verified_by: string; verified_at: Date | null }>(
      `select verified_by, verified_at from public.compatibility_links where id = $1`, [link!.id]);
    expect(row!.verified_by).toBe(staff.id);
    expect(row!.verified_at).not.toBeNull();

    for (const v of Object.values(cat.implantVariants)) {
      const comps = await getComponents(anon, v);
      expect(comps.map((c) => c.component_product_id)).toEqual([cat.abutmentProductId]);
      expect(comps[0]!.implant_scope).toBe('platform');
      expect(comps[0]!.evidence_type).toBe('manufacturer_catalog');
    }
    expect(await check(customer.actor, cat.implantVariants.d35l10, cat.abutmentVariantId)).toBe('verified');
  });

  it('no infiere compatibilidad para otra plataforma aunque sea del mismo sistema y marca', async () => {
    const [otherPlatform] = await admin<{ id: string }>(
      `insert into public.platforms (implant_system_id, code, name) values ($1, 'NP', 'Estrecha') returning id`, [cat.systemId]);
    const [v] = await admin<{ id: string }>(
      `insert into public.product_variants (product_id, sku, diameter_mm, length_mm, platform_id)
       values ($1, $2, 3.3, 10, $3) returning id`, [cat.implantProductId, `IMP-${cat.tag}-3310`, otherPlatform!.id]);
    expect(await getComponents(customer.actor, v!.id)).toEqual([]);
    expect(await check(customer.actor, v!.id, cat.abutmentVariantId)).toBe('unverified');
  });

  it('una incompatibilidad verificada tiene precedencia y se informa como tal', async () => {
    await query(staff.actor,
      `insert into public.compatibility_links (implant_scope, implant_variant_id, component_product_id, status,
                                               evidence_type, evidence_reference)
       values ('variant', $1, $2, 'rejected', 'manufacturer_ifu', 'IFU rev. 3, sección 2: no usar en Ø3.5')`,
      [cat.implantVariants.d35l10, cat.abutmentProductId]);
    expect(await check(customer.actor, cat.implantVariants.d35l10, cat.abutmentVariantId)).toBe('incompatible');
    expect(await check(customer.actor, cat.implantVariants.d40l10, cat.abutmentVariantId)).toBe('verified');
  });

  it('una compatibilidad verificada no se elimina: se retira, y todo queda auditado', async () => {
    const [link] = await admin<{ id: string }>(
      `select id from public.compatibility_links where component_product_id = $1 and status = 'verified'`, [cat.abutmentProductId]);
    expect(await query(staff.actor, `delete from public.compatibility_links where id = $1 returning id`, [link!.id])).toEqual([]);
    await query(staff.actor, `update public.compatibility_links set status = 'retired' where id = $1`, [link!.id]);
    expect(await getComponents(customer.actor, cat.implantVariants.d40l10)).toEqual([]);
    const audit = await admin<{ action: string }>(
      `select action from public.audit_log where table_name = 'compatibility_links' and record_id = $1 order by id`, [link!.id]);
    expect(audit.map((a) => a.action)).toEqual(['INSERT', 'UPDATE', 'UPDATE']);
  });

  it('la variante del componente debe pertenecer al producto componente', async () => {
    await expectDbError(
      query(staff.actor,
        `insert into public.compatibility_links (implant_scope, platform_id, component_product_id, component_variant_id)
         values ('platform', $1, $2, $3)`, [cat.platformId, cat.abutmentProductId, cat.implantVariants.d40l10]),
      { message: 'INVALID_INPUT' });
  });

  it('las alternativas comerciales están separadas de las compatibilidades', async () => {
    await query(staff.actor,
      `insert into public.product_alternatives (product_id, alternative_product_id, notes)
       values ($1, $2, 'Alternativa de compra (prueba)')`, [cat.implantProductId, cat.abutmentProductId]);
    expect(await check(customer.actor, cat.implantVariants.d40l10, cat.abutmentVariantId)).not.toBe('verified');
  });
});
