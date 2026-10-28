/**
 * Aislamiento entre cuentas y permisos (CTA-14, SEG-01, ROL-02).
 * Criterio de aceptación 18: los usuarios no pueden acceder a información ajena.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admin,
  as,
  createAddress,
  createUser,
  expectDbError,
  pool,
  query,
  type TestUser,
} from './helpers/db';

let alice: TestUser;
let bob: TestUser;
let aliceAddress: string;

beforeAll(async () => {
  alice = await createUser({ fullName: 'Alicia Prueba' });
  bob = await createUser({ fullName: 'Roberto Prueba' });
  aliceAddress = await createAddress(alice);
});

afterAll(async () => {
  await pool.end();
});

describe('perfiles', () => {
  it('el alta crea el perfil con datos validados del registro', async () => {
    const [p] = await admin(`select full_name, phone, account_type, professional_status from public.profiles where id = $1`, [alice.id]);
    expect(p).toEqual({ full_name: 'Alicia Prueba', phone: '+56912345678', account_type: 'dentist', professional_status: 'not_requested' });
  });

  it('cada usuario ve solo su propio perfil', async () => {
    const rows = await query(alice.actor, `select id from public.profiles`);
    expect(rows.map((r) => r.id)).toEqual([alice.id]);
  });

  it('un usuario anónimo no ve perfiles', async () => {
    expect(await query({ kind: 'anon' }, `select id from public.profiles`)).toEqual([]);
  });

  it('el usuario edita sus datos personales', async () => {
    await query(alice.actor, `update public.profiles set full_name = 'Alicia P.' where id = $1`, [alice.id]);
    const [p] = await admin(`select full_name from public.profiles where id = $1`, [alice.id]);
    expect(p!.full_name).toBe('Alicia P.');
  });

  it('el usuario NO puede auto-verificarse como profesional', async () => {
    await expectDbError(
      query(alice.actor, `update public.profiles set professional_status = 'verified' where id = $1`, [alice.id]),
      { code: '42501' },
    );
  });

  it('el usuario no puede modificar el perfil de otro', async () => {
    const rows = await query(bob.actor, `update public.profiles set full_name = 'Hackeado' where id = $1 returning id`, [alice.id]);
    expect(rows).toEqual([]);
    const [p] = await admin(`select full_name from public.profiles where id = $1`, [alice.id]);
    expect(p!.full_name).not.toBe('Hackeado');
  });

  it('los metadatos del registro no otorgan roles ni verificación', async () => {
    const mallory = await createUser({
      meta: { account_type: 'superadmin', professional_status: 'verified', role: 'service_role' },
    });
    const [p] = await admin(`select account_type, professional_status from public.profiles where id = $1`, [mallory.id]);
    expect(p).toEqual({ account_type: 'general', professional_status: 'not_requested' });
    expect(await admin(`select 1 from public.user_roles where user_id = $1`, [mallory.id])).toEqual([]);
  });
});

describe('direcciones', () => {
  it('otro usuario no puede ver, modificar ni eliminar la dirección', async () => {
    expect(await query(bob.actor, `select id from public.addresses where id = $1`, [aliceAddress])).toEqual([]);
    expect(await query(bob.actor, `update public.addresses set street = 'X' where id = $1 returning id`, [aliceAddress])).toEqual([]);
    expect(await query(bob.actor, `delete from public.addresses where id = $1 returning id`, [aliceAddress])).toEqual([]);
  });

  it('no se puede crear una dirección a nombre de otro usuario', async () => {
    await expectDbError(
      query(bob.actor,
        `insert into public.addresses (user_id, recipient_name, phone, street, street_number, comuna_code)
         values ($1, 'Intruso', '+56912345678', 'Calle', '1', '13101')`, [alice.id]),
      { code: '42501' },
    );
  });

  it('solo hay una dirección predeterminada por usuario', async () => {
    const second = await createAddress(alice, '13114');
    const rows = await query<{ id: string; is_default: boolean }>(alice.actor,
      `select id, is_default from public.addresses where user_id = $1 and is_default`, [alice.id]);
    expect(rows.map((r) => r.id)).toEqual([second]);
  });

  it('rechaza comunas inexistentes y teléfonos inválidos', async () => {
    await expectDbError(
      query(alice.actor,
        `insert into public.addresses (user_id, recipient_name, phone, street, street_number, comuna_code)
         values ($1, 'Destinatario', '+56912345678', 'Calle', '1', '99999')`, [alice.id]),
      { code: '23503' },
    );
    await expectDbError(
      query(alice.actor,
        `insert into public.addresses (user_id, recipient_name, phone, street, street_number, comuna_code)
         values ($1, 'Destinatario', '12345', 'Calle', '1', '13101')`, [alice.id]),
      { code: '23514' },
    );
  });
});

describe('facturación', () => {
  it('valida y normaliza el RUT', async () => {
    const [b] = await query<{ rut: string }>(alice.actor,
      `insert into public.billing_profiles (user_id, rut, business_name, giro, address_line, comuna_code, dte_email)
       values ($1, '12.345.678-5', 'Clínica de Prueba SpA', 'Servicios odontológicos', 'Av. Prueba 100', '13101', 'DTE@Prueba.cl')
       returning rut`, [alice.id]);
    expect(b!.rut).toBe('12345678-5');
    await expectDbError(
      query(alice.actor,
        `insert into public.billing_profiles (user_id, rut, business_name, giro, address_line, comuna_code, dte_email)
         values ($1, '12.345.678-4', 'X SpA', 'Giro', 'Dir 1', '13101', 'a@b.cl')`, [alice.id]),
      { code: '23514' },
    );
  });

  it('otro usuario no ve los datos de facturación', async () => {
    expect(await query(bob.actor, `select id from public.billing_profiles where user_id = $1`, [alice.id])).toEqual([]);
  });
});

describe('consentimientos', () => {
  it('registra consentimientos de marketing propios (historial)', async () => {
    await query(alice.actor, `insert into public.consents (user_id, consent_type, granted) values ($1, 'marketing_email', true)`, [alice.id]);
    await query(alice.actor, `insert into public.consents (user_id, consent_type, granted) values ($1, 'marketing_email', false)`, [alice.id]);
    const rows = await query<{ granted: boolean }>(alice.actor,
      `select granted from public.current_consents where user_id = $1 and consent_type = 'marketing_email'`, [alice.id]);
    expect(rows).toEqual([{ granted: false }]);
  });

  it('no permite registrar consentimientos a nombre de otro ni términos sin documento', async () => {
    await expectDbError(
      query(bob.actor, `insert into public.consents (user_id, consent_type, granted) values ($1, 'marketing_email', true)`, [alice.id]),
      { code: '42501' },
    );
    await expectDbError(
      query(alice.actor, `insert into public.consents (user_id, consent_type, granted) values ($1, 'terms', true)`, [alice.id]),
      { code: '42501' },
    );
  });

  it('los consentimientos no se modifican ni se borran', async () => {
    await expectDbError(query(alice.actor, `update public.consents set granted = true where user_id = $1`, [alice.id]), { code: '42501' });
    await expectDbError(query(alice.actor, `delete from public.consents where user_id = $1`, [alice.id]), { code: '42501' });
  });

  it('acepta las versiones vigentes de los documentos legales', async () => {
    const [doc] = await admin<{ id: string }>(
      `insert into public.legal_documents (kind, version, title, url, published_at, is_current)
       values ('terms', 'test-1', 'Términos (prueba)', 'https://example.invalid/terminos', now(), true) returning id`);
    const [before] = await admin<{ ok: boolean }>(`select private.has_accepted_current_legal($1) as ok`, [alice.id]);
    expect(before!.ok).toBe(false);
    await query(alice.actor, `select public.accept_current_legal_documents('app')`);
    const [after] = await admin<{ ok: boolean }>(`select private.has_accepted_current_legal($1) as ok`, [alice.id]);
    expect(after!.ok).toBe(true);
    // Limpieza: el documento de prueba deja de estar vigente para no afectar otras pruebas.
    await admin(`update public.legal_documents set is_current = false where id = $1`, [doc!.id]);
  });
});

describe('roles y permisos del personal', () => {
  it('un cliente no tiene permisos internos', async () => {
    const [r] = await query<{ access: { is_staff: boolean; permissions: string[] } }>(alice.actor, `select public.get_my_access() as access`);
    expect(r!.access.is_staff).toBe(false);
    expect(r!.access.permissions).toEqual([]);
  });

  it('un cliente no puede asignarse roles', async () => {
    await expectDbError(query(alice.actor, `select public.assign_role($1, 'admin_general')`, [alice.id]), { message: 'PERMISSION_DENIED' });
    await expectDbError(
      query(alice.actor, `insert into public.user_roles (user_id, role_code) values ($1, 'admin_general')`, [alice.id]),
      { code: '42501' },
    );
  });

  it('el personal sin MFA (aal1) no obtiene permisos; con aal2 sí', async () => {
    const staff = await createUser({ roles: ['vendedor'] });
    const aal1 = { kind: 'user' as const, id: staff.id, aal: 'aal1' as const };
    const aal2 = { kind: 'user' as const, id: staff.id, aal: 'aal2' as const };
    expect(await query(aal1, `select id from public.profiles where id = $1`, [alice.id])).toEqual([]);
    expect(await query(aal2, `select id from public.profiles where id = $1`, [alice.id])).toHaveLength(1);
    await expectDbError(query(aal1, `select public.find_orders_by_lot(gen_random_uuid())`), { message: 'MFA_REQUIRED' });
  });

  it('el administrador asigna y retira roles, y queda auditado', async () => {
    const adminUser = await createUser({ roles: ['admin_general'] });
    await query(adminUser.actor, `select public.assign_role($1, 'soporte')`, [bob.id]);
    expect(await admin(`select role_code from public.user_roles where user_id = $1`, [bob.id])).toEqual([{ role_code: 'soporte' }]);
    await query(adminUser.actor, `select public.revoke_role($1, 'soporte')`, [bob.id]);
    const audit = await admin<{ action: string; actor_id: string }>(
      `select action, actor_id from public.audit_log where table_name = 'user_roles' and record_id = $1 order by id`,
      [`${bob.id}:soporte`]);
    expect(audit.map((a) => a.action)).toEqual(['INSERT', 'DELETE']);
    expect(audit.every((a) => a.actor_id === adminUser.id)).toBe(true);
  });

  it('la auditoría no se puede escribir ni borrar desde la API', async () => {
    const adminUser = await createUser({ roles: ['admin_general'] });
    await expectDbError(query(adminUser.actor, `delete from public.audit_log`), { code: '42501' });
    await expectDbError(
      query(adminUser.actor, `insert into public.audit_log (action) values ('falso')`),
      { code: '42501' },
    );
  });
});

describe('verificación profesional', () => {
  it('el usuario solicita; solo el personal aprueba; queda auditado', async () => {
    const pro = await createUser();
    const [r] = await query<{ id: string }>(pro.actor,
      `select public.submit_professional_verification('dentist', '30.686.957-4', 'RNPI-12345') as id`);
    const [p1] = await admin(`select professional_status, rut from public.profiles where id = $1`, [pro.id]);
    expect(p1).toEqual({ professional_status: 'pending', rut: '30686957-4' });

    await expectDbError(
      query(pro.actor, `select public.review_professional_verification($1, 'approved')`, [r!.id]),
      { message: 'PERMISSION_DENIED' },
    );

    const reviewer = await createUser({ roles: ['admin_comercial'] });
    await query(reviewer.actor, `select public.review_professional_verification($1, 'approved', 'Registro verificado')`, [r!.id]);
    const [p2] = await admin(`select professional_status from public.profiles where id = $1`, [pro.id]);
    expect(p2!.professional_status).toBe('verified');
    const audit = await admin(`select 1 from public.audit_log where table_name = 'professional_verifications' and record_id = $1 and action = 'UPDATE'`, [r!.id]);
    expect(audit.length).toBeGreaterThan(0);
  });

  it('rechaza RUT inválido', async () => {
    const pro = await createUser();
    await expectDbError(
      query(pro.actor, `select public.submit_professional_verification('dentist', '12.345.678-4', 'RNPI-1')`),
      { message: 'INVALID_RUT' },
    );
  });
});

describe('escrituras directas bloqueadas', () => {
  it.each([
    `insert into public.orders (order_number) values ('X')`,
    `update public.stock_balances set on_hand = 1000`,
    `insert into public.payments (order_id, provider, amount, buy_order) values (gen_random_uuid(), 'x', 1, 'X1')`,
    `insert into public.price_list_items (price_list_id, variant_id, unit_price_net) values (gen_random_uuid(), gen_random_uuid(), 1)`,
    `insert into public.cart_items (cart_id, variant_id, quantity) values (gen_random_uuid(), gen_random_uuid(), 1)`,
  ])('cliente: %s', async (sql) => {
    await expectDbError(query(alice.actor, sql), { code: '42501' });
  });

  it('un cliente no puede ejecutar funciones de servicio', async () => {
    await expectDbError(query(alice.actor, `select public.release_expired_reservations()`), { code: '42501' });
    await expectDbError(
      query(alice.actor, `select public.apply_payment_result(gen_random_uuid(), 'approved', 1, 'evt')`),
      { code: '42501' },
    );
    await expectDbError(query({ kind: 'anon' }, `select public.place_order('clave-de-prueba', 'boleta', 'standard')`), { code: '42501' });
  });

  it('pruebas de transacción aisladas no dejan rastro (rollback)', async () => {
    await as(alice.actor, async (q) => {
      await q(`update public.profiles set full_name = 'Temporal' where id = $1`, [alice.id]);
    }, { rollback: true });
    const [p] = await admin(`select full_name from public.profiles where id = $1`, [alice.id]);
    expect(p!.full_name).not.toBe('Temporal');
  });
});
