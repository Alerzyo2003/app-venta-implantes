/**
 * Utilidades de prueba: conexión a la base local y ejecución "como" un rol de la API,
 * replicando lo que hace PostgREST (SET LOCAL ROLE + request.jwt.claims).
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const port = process.env.LOCAL_DB_PORT ?? '54329';
const database = process.env.LOCAL_DB_NAME ?? 'implantes';
export const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgres://supabase_admin@127.0.0.1:${port}/${database}`;

// bigint (int8) como number: los montos CLP de prueba son enteros seguros.
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 12 });

export type Actor =
  | { kind: 'anon' }
  | { kind: 'service' }
  | { kind: 'user'; id: string; aal?: 'aal1' | 'aal2'; email?: string };

export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

/** Ejecuta SQL como superusuario (preparación de datos de prueba). */
export async function admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

function claimsFor(actor: Actor): { role: string; claims: Record<string, unknown> } {
  switch (actor.kind) {
    case 'anon':
      return { role: 'anon', claims: { role: 'anon' } };
    case 'service':
      return { role: 'service_role', claims: { role: 'service_role' } };
    case 'user':
      return {
        role: 'authenticated',
        claims: {
          sub: actor.id,
          role: 'authenticated',
          aud: 'authenticated',
          aal: actor.aal ?? 'aal1',
          email: actor.email,
        },
      };
  }
}

/**
 * Ejecuta `fn` en una transacción con el rol y los claims del actor.
 * Por defecto confirma (commit); con { rollback: true } deshace los cambios.
 */
export async function as<T>(actor: Actor, fn: (q: Query) => Promise<T>, opts: { rollback?: boolean } = {}): Promise<T> {
  const client = await pool.connect();
  const { role, claims } = claimsFor(actor);
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const q: Query = async (sql, params = []) => (await client.query(sql, params)).rows as never;
    const result = await fn(q);
    await client.query(opts.rollback ? 'rollback' : 'commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Atajo: una sola consulta como actor. */
export async function query<T = Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
  return as(actor, (q) => q<T>(sql, params));
}

/** Espera que la promesa falle con un mensaje (código de negocio) o SQLSTATE. */
export async function expectDbError(promise: Promise<unknown>, expected: { message?: string | RegExp; code?: string }) {
  try {
    await promise;
  } catch (err) {
    const e = err as { message?: string; code?: string };
    if (expected.code && e.code !== expected.code) {
      throw new Error(`Se esperaba SQLSTATE ${expected.code} y llegó ${e.code}: ${e.message}`);
    }
    if (expected.message) {
      const ok = typeof expected.message === 'string' ? e.message === expected.message : expected.message.test(e.message ?? '');
      if (!ok) throw new Error(`Se esperaba el error "${String(expected.message)}" y llegó "${e.message}" (${e.code})`);
    }
    return e;
  }
  throw new Error('Se esperaba un error y la operación se completó');
}

export const uid = () => randomUUID();

/** Código de rol de prueba (solo letras y guion bajo, como exige roles.code). */
export const roleCode = (prefix: string) =>
  `${prefix}_${randomUUID().replace(/[^a-f]/g, '').slice(0, 8) || 'x'}`;
// Prefijo 't' para que el texto no se confunda con marcadores de medida ("d4", "l10") del buscador.
export const suffix = () => `t${randomUUID().replace(/-/g, '').slice(0, 7)}`;

// ---------------------------------------------------------------------------
// Datos de prueba (marcados como PRUEBA; solo existen en la base local de tests)
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  actor: Actor;
}

export async function createUser(opts: {
  fullName?: string;
  accountType?: string;
  confirmed?: boolean;
  meta?: Record<string, unknown>;
  roles?: string[];
  professionalVerified?: boolean;
} = {}): Promise<TestUser> {
  const id = uid();
  const email = `prueba-${id.slice(0, 8)}@test.invalid`;
  const meta = {
    full_name: opts.fullName ?? 'Usuario de prueba',
    account_type: opts.accountType ?? 'dentist',
    phone: '+56912345678',
    ...opts.meta,
  };
  await admin(
    `insert into auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data)
     values ($1, $2, 'authenticated', 'authenticated', $3, $4)`,
    [id, email, opts.confirmed === false ? null : new Date().toISOString(), JSON.stringify(meta)],
  );
  for (const role of opts.roles ?? []) {
    await admin(`insert into public.user_roles (user_id, role_code) values ($1, $2)`, [id, role]);
  }
  if (opts.professionalVerified) {
    await admin(`update public.profiles set professional_status = 'verified' where id = $1`, [id]);
  }
  const isStaff = (opts.roles ?? []).length > 0;
  return { id, email, actor: { kind: 'user', id, email, aal: isStaff ? 'aal2' : 'aal1' } };
}

export async function setSetting(key: string, value: unknown) {
  await admin(`update public.app_settings set value = $2::jsonb where key = $1`, [key, JSON.stringify(value)]);
}

export interface CatalogFixture {
  tag: string;
  categoryId: string;
  manufacturerId: string;
  brandId: string;
  systemId: string;
  platformId: string;
  connectionTypeId: string;
  implantProductId: string;
  implantVariants: { d40l10: string; d40l115: string; d35l10: string };
  abutmentProductId: string;
  abutmentVariantId: string;
  warehouseId: string;
}

/**
 * Catálogo mínimo de PRUEBA: un implante con 3 medidas (con lote y vencimiento) y un pilar
 * (sin lote), con precios en la lista base y una bodega vendible.
 */
export async function createCatalog(opts: { requiresProfessional?: boolean; status?: string } = {}): Promise<CatalogFixture> {
  const tag = suffix();
  const [cat] = await admin<{ id: string }>(`select id from public.categories where slug = 'implantes-dentales'`);
  const [mf] = await admin<{ id: string }>(
    `insert into public.manufacturers (name) values ($1) returning id`, [`Fabricante Prueba ${tag}`]);
  const [br] = await admin<{ id: string }>(
    `insert into public.brands (name, manufacturer_id) values ($1, $2) returning id`, [`Marca Prueba ${tag}`, mf!.id]);
  const [sy] = await admin<{ id: string }>(
    `insert into public.implant_systems (manufacturer_id, brand_id, name) values ($1, $2, $3) returning id`,
    [mf!.id, br!.id, `Sistema Prueba ${tag}`]);
  const [ct] = await admin<{ id: string }>(
    `insert into public.connection_types (name) values ($1) returning id`, [`Conexión Prueba ${tag}`]);
  const [pl] = await admin<{ id: string }>(
    `insert into public.platforms (implant_system_id, code, name, connection_type_id) values ($1, 'RP', 'Regular', $2) returning id`,
    [sy!.id, ct!.id]);

  // Los productos se insertan como superusuario: el trigger de publicación exige
  // 'catalog.publish' solo a usuarios autenticados sin permiso (service/admin pasan).
  const [imp] = await admin<{ id: string }>(
    `insert into public.products (category_id, brand_id, manufacturer_id, implant_system_id, product_kind, name, slug,
                                  short_description, tracks_lots, tracks_expiry, requires_professional, status)
     values ($1, $2, $3, $4, 'implant', $5, $6, 'Producto de prueba', true, true, $7, $8) returning id`,
    [cat!.id, br!.id, mf!.id, sy!.id, `Implante Cónico Prueba ${tag}`, `implante-conico-prueba-${tag}`,
     opts.requiresProfessional ?? false, opts.status ?? 'published']);
  const variant = async (sku: string, d: number, l: number) => {
    const [v] = await admin<{ id: string }>(
      `insert into public.product_variants (product_id, sku, manufacturer_ref, diameter_mm, length_mm, platform_id, connection_type_id, label)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [imp!.id, sku, `REF.${sku}`, d, l, pl!.id, ct!.id, `Ø ${d} × ${l} mm`]);
    return v!.id;
  };
  const d40l10 = await variant(`IMP-${tag}-4010`, 4.0, 10);
  const d40l115 = await variant(`IMP-${tag}-40115`, 4.0, 11.5);
  const d35l10 = await variant(`IMP-${tag}-3510`, 3.5, 10);

  const [catAb] = await admin<{ id: string }>(`select id from public.categories where slug = 'pilares'`);
  const [ab] = await admin<{ id: string }>(
    `insert into public.products (category_id, brand_id, manufacturer_id, implant_system_id, product_kind, name, slug, status)
     values ($1, $2, $3, $4, 'abutment', $5, $6, 'published') returning id`,
    [catAb!.id, br!.id, mf!.id, sy!.id, `Pilar Recto Prueba ${tag}`, `pilar-recto-prueba-${tag}`]);
  const [abv] = await admin<{ id: string }>(
    `insert into public.product_variants (product_id, sku, platform_id) values ($1, $2, $3) returning id`,
    [ab!.id, `PIL-${tag}`, pl!.id]);

  const [base] = await admin<{ id: string }>(`select id from public.price_lists where code = 'base'`);
  const prices: Array<[string, number]> = [[d40l10, 89990], [d40l115, 89990], [d35l10, 84990], [abv!.id, 45990]];
  for (const [v, price] of prices) {
    await admin(`insert into public.price_list_items (price_list_id, variant_id, unit_price_net) values ($1, $2, $3)`,
      [base!.id, v, price]);
  }

  const [wh] = await admin<{ id: string }>(
    `insert into public.warehouses (code, name, comuna_code, is_sellable, is_pickup_point, priority)
     values ($1, 'Bodega de prueba', '13101', true, true, 10) returning id`, [`T${tag.toUpperCase()}`]);

  return {
    tag,
    categoryId: cat!.id,
    manufacturerId: mf!.id,
    brandId: br!.id,
    systemId: sy!.id,
    platformId: pl!.id,
    connectionTypeId: ct!.id,
    implantProductId: imp!.id,
    implantVariants: { d40l10, d40l115, d35l10 },
    abutmentProductId: ab!.id,
    abutmentVariantId: abv!.id,
    warehouseId: wh!.id,
  };
}

/** Usuario interno con todos los permisos y MFA verificado (aal2). */
export async function createAdmin(): Promise<TestUser> {
  return createUser({ fullName: 'Administrador de prueba', roles: ['admin_general'] });
}

/** Ingresa stock usando la función real (con permisos de inventario). */
export async function receiveStock(staff: Actor, variantId: string, warehouseId: string, qty: number,
  lot?: { number: string; expiry?: string }) {
  await query(staff, `select public.inventory_receive($1, $2, $3, $4, $5::date, 'Ingreso de prueba')`,
    [variantId, warehouseId, qty, lot?.number ?? null, lot?.expiry ?? null]);
}

/** Activa el despacho estándar con una tarifa general y el retiro gratuito. */
export async function enableShipping(priceNet = 4990, estMin = 1, estMax = 3) {
  await admin(`update public.shipping_methods set is_active = true where code in ('standard', 'pickup')`);
  await admin(
    `insert into public.shipping_rates (method_code, price_net, est_days_min, est_days_max)
     values ('standard', $1, $2, $3)
     on conflict (method_code, coalesce(region_code, ''), coalesce(comuna_code, '')) do update
       set price_net = excluded.price_net, est_days_min = excluded.est_days_min, est_days_max = excluded.est_days_max`,
    [priceNet, estMin, estMax]);
  await admin(
    `insert into public.shipping_rates (method_code, price_net, est_days_min, est_days_max)
     values ('pickup', 0, 0, 1)
     on conflict (method_code, coalesce(region_code, ''), coalesce(comuna_code, '')) do nothing`);
}

export async function createAddress(user: TestUser, comuna = '13123'): Promise<string> {
  const [a] = await query<{ id: string }>(user.actor,
    `insert into public.addresses (user_id, recipient_name, phone, street, street_number, comuna_code, is_default)
     values ($1, 'Destinatario Prueba', '+56912345678', 'Calle de Prueba', '123', $2, true) returning id`,
    [user.id, comuna]);
  return a!.id;
}
