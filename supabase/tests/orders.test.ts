/**
 * Carrito, pedidos, reservas, pagos y despacho (CAR, PAG, DES, INV-05).
 * Criterios de aceptación 2, 3, 6, 7 (parte servidor) y 18.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeTotals } from '@repo/domain';
import {
  admin,
  createAddress,
  createAdmin,
  createCatalog,
  createUser,
  enableShipping,
  expectDbError,
  pool,
  query,
  receiveStock,
  setSetting,
  suffix,
  type Actor,
  type CatalogFixture,
  type TestUser,
} from './helpers/db';

const service: Actor = { kind: 'service' };
let cat: CatalogFixture;
let staff: TestUser;

type Summary = {
  item_count: number;
  can_checkout: boolean;
  issues: string[];
  items: Array<{ variant_id: string; quantity: number; unit_price_net: number | null; issue: string | null }>;
  shipping: { available: boolean; price_net?: number; issue?: string } | null;
  totals: { total: number; tax_amount: number; taxable_net: number; shipping_net: number } | null;
};
type PlaceResult = { order_id: string; order_number: string; status: string; total: number; created: boolean };

const add = (u: TestUser, variant: string, qty = 1) =>
  query(u.actor, `select public.cart_add_item($1, $2)`, [variant, qty]);

async function summary(u: TestUser, opts: { doc?: string; method?: string; address?: string | null; pickup?: string | null } = {}) {
  const [r] = await query<{ s: Summary }>(u.actor,
    `select public.get_cart_summary($1, $2, $3, $4) as s`,
    [opts.doc ?? 'boleta', opts.method ?? null, opts.address ?? null, opts.pickup ?? null]);
  return r!.s;
}

async function place(u: TestUser, opts: {
  key?: string; doc?: string; method?: string; address?: string | null; billing?: string | null;
  pickup?: string | null; expected?: number | null;
}): Promise<PlaceResult> {
  const [r] = await query<{ r: PlaceResult }>(u.actor,
    `select public.place_order(
        p_idempotency_key => $1, p_document_type => $2, p_shipping_method_code => $3, p_address_id => $4,
        p_billing_profile_id => $5, p_pickup_warehouse_id => $6, p_expected_total => $7) as r`,
    [opts.key ?? `clave-${suffix()}`, opts.doc ?? 'boleta', opts.method ?? 'standard', opts.address ?? null,
     opts.billing ?? null, opts.pickup ?? null, opts.expected ?? null]);
  return r!.r;
}

async function stock(variant: string) {
  const [b] = await admin<{ on_hand: number; reserved: number; committed: number }>(
    `select on_hand, reserved, committed from public.stock_balances where variant_id = $1 and warehouse_id = $2`,
    [variant, cat.warehouseId]);
  return b!;
}

async function orderRow(id: string) {
  const [o] = await admin<{ status: string; payment_status: string; fulfillment_status: string; user_id: string | null; total: number }>(
    `select status, payment_status, fulfillment_status, user_id, total from public.orders where id = $1`, [id]);
  return o!;
}

async function newCustomer(opts: { confirmed?: boolean; verified?: boolean } = {}) {
  const u = await createUser({ confirmed: opts.confirmed, professionalVerified: opts.verified });
  const address = await createAddress(u);
  return { u, address };
}

async function payAttempt(orderId: string) {
  const [r] = await query<{ r: { payment_id: string; buy_order: string; amount: number } }>(service,
    `select public.create_payment_attempt($1, 'test_provider', 'credit_card') as r`, [orderId]);
  return r!.r;
}

async function applyPayment(paymentId: string, status: string, amount: number, eventId = `evt-${suffix()}`) {
  const [r] = await query<{ r: { applied: boolean; result: string; duplicate?: boolean; payment_status: string; order_status: string } }>(
    service,
    `select public.apply_payment_result(p_payment_id => $1, p_new_status => $2, p_amount => $3, p_provider_event_id => $4,
        p_payload => '{"origen": "prueba"}'::jsonb, p_signature_valid => true, p_authorization_code => '123456',
        p_card_last4 => '6623') as r`,
    [paymentId, status, amount, eventId]);
  return r!.r;
}

beforeAll(async () => {
  cat = await createCatalog();
  staff = await createAdmin();
  await enableShipping(4990, 1, 3);
  // Implante Ø4.0×10: dos lotes con distinto vencimiento (para FEFO).
  await receiveStock(staff.actor, cat.implantVariants.d40l10, cat.warehouseId, 3, { number: 'L1-2030', expiry: '2030-12-31' });
  await receiveStock(staff.actor, cat.implantVariants.d40l10, cat.warehouseId, 2, { number: 'L2-2029', expiry: '2029-03-31' });
  // Implante Ø3.5×10: 3 unidades (prueba de concurrencia).
  await receiveStock(staff.actor, cat.implantVariants.d35l10, cat.warehouseId, 3, { number: 'L3', expiry: '2031-01-31' });
  // Pilar sin lote: stock amplio para toda la suite.
  await receiveStock(staff.actor, cat.abutmentVariantId, cat.warehouseId, 100);
});

afterAll(async () => {
  await pool.end();
});

describe('carrito y cotización del servidor (CAR-01..03)', () => {
  it('el total del servidor coincide con el dominio (boleta)', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 2);
    await add(u, cat.implantVariants.d40l10, 1);
    const s = await summary(u, { method: 'standard', address });
    const expected = computeTotals({
      priceMode: 'gross', taxRateBp: 1900, shippingNet: 4990,
      lines: [
        { unitPriceNet: 45990, quantity: 2, taxClass: 'iva' },
        { unitPriceNet: 89990, quantity: 1, taxClass: 'iva' },
      ],
    });
    expect(s.can_checkout).toBe(true);
    expect(s.item_count).toBe(3);
    expect(s.totals!.total).toBe(expected.total);
    expect(s.totals!.tax_amount).toBe(expected.taxAmount);
  });

  it('cart_add_item acumula y cart_set_item fija o elimina', async () => {
    const { u } = await newCustomer();
    await add(u, cat.abutmentVariantId, 2);
    await add(u, cat.abutmentVariantId, 3);
    expect((await summary(u)).items[0]!.quantity).toBe(5);
    await query(u.actor, `select public.cart_set_item($1, 1)`, [cat.abutmentVariantId]);
    expect((await summary(u)).items[0]!.quantity).toBe(1);
    await query(u.actor, `select public.cart_set_item($1, 0)`, [cat.abutmentVariantId]);
    expect((await summary(u)).items).toEqual([]);
    await expectDbError(query(u.actor, `select public.cart_set_item($1, 1000)`, [cat.abutmentVariantId]), { message: 'INVALID_QUANTITY' });
  });

  it('marca falta de stock en el carrito y no permite el checkout', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 999);
    const s = await summary(u, { method: 'standard', address });
    expect(s.issues).toEqual(['OUT_OF_STOCK']);
    expect(s.can_checkout).toBe(false);
  });

  it('producto exclusivo para profesionales: solo cuentas verificadas', async () => {
    await admin(`update public.products set requires_professional = true where id = $1`, [cat.implantProductId]);
    try {
      const { u } = await newCustomer();
      await expectDbError(add(u, cat.implantVariants.d40l10), { message: 'PROFESSIONAL_VERIFICATION_REQUIRED' });
      const { u: pro } = await newCustomer({ verified: true });
      await add(pro, cat.implantVariants.d40l10);
    } finally {
      await admin(`update public.products set requires_professional = false where id = $1`, [cat.implantProductId]);
    }
  });

  it('sin cobertura de despacho en la comuna', async () => {
    await admin(`update public.shipping_methods set is_active = true where code = 'priority'`);
    await admin(`insert into public.shipping_rates (method_code, comuna_code, price_net, est_days_min, est_days_max)
                 values ('priority', '13114', 7990, 0, 1)`);
    const { u, address } = await newCustomer(); // dirección en 13123 (Providencia)
    await add(u, cat.abutmentVariantId);
    const s = await summary(u, { method: 'priority', address });
    expect(s.shipping).toMatchObject({ available: false, issue: 'SHIPPING_NOT_AVAILABLE' });
    await expectDbError(place(u, { method: 'priority', address }), { message: 'SHIPPING_NOT_AVAILABLE' });
  });
});

describe('creación de pedidos (CAR-04..07)', () => {
  it('PRICE_CHANGED si el total confirmado por el cliente no coincide; no crea pedido', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 1);
    const s = await summary(u, { method: 'standard', address });
    const err = await expectDbError(place(u, { address, expected: s.totals!.total - 1 }), { message: 'PRICE_CHANGED' });
    expect(JSON.parse((err as { hint: string }).hint)).toEqual({ total: s.totals!.total });
    expect(await admin(`select 1 from public.orders where user_id = $1`, [u.id])).toEqual([]);
  });

  it('crea el pedido, reserva stock, guarda snapshots y convierte el carrito', async () => {
    const { u, address } = await newCustomer();
    const before = await stock(cat.abutmentVariantId);
    await add(u, cat.abutmentVariantId, 2);
    const s = await summary(u, { method: 'standard', address });
    const r = await place(u, { address, expected: s.totals!.total });
    expect(r).toMatchObject({ status: 'pending_payment', total: s.totals!.total, created: true });
    expect(r.order_number).toMatch(/^P\d{2}-\d{6}$/);

    const after = await stock(cat.abutmentVariantId);
    expect(after.reserved - before.reserved).toBe(2);
    expect(after.on_hand).toBe(before.on_hand);

    const items = await query<{ sku: string; quantity: number; unit_price_net: number; unit_price_gross: number; line_total: number }>(
      u.actor, `select sku, quantity, unit_price_net, unit_price_gross, line_total from public.order_items where order_id = $1`, [r.order_id]);
    expect(items).toEqual([{ sku: `PIL-${cat.tag}`, quantity: 2, unit_price_net: 45990, unit_price_gross: 54728, line_total: 109456 }]);

    const [o] = await query<{ shipping_address_snapshot: { comuna: string; region: string }; customer_snapshot: { email: string } }>(
      u.actor, `select shipping_address_snapshot, customer_snapshot from public.orders where id = $1`, [r.order_id]);
    expect(o!.shipping_address_snapshot).toMatchObject({ comuna: 'Providencia', region: 'Región Metropolitana de Santiago' });
    expect(o!.customer_snapshot.email).toBe(u.email);

    expect((await summary(u)).items).toEqual([]);
    const history = await query<{ to_status: string }>(u.actor, `select to_status from public.order_status_history where order_id = $1`, [r.order_id]);
    expect(history).toEqual([{ to_status: 'pending_payment' }]);
  });

  it('idempotente: reintentar con la misma clave devuelve el mismo pedido sin duplicar (CAR-05)', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 1);
    const key = `doble-toque-${suffix()}`;
    const before = await stock(cat.abutmentVariantId);
    const [a, b] = await Promise.all([place(u, { key, address }), place(u, { key, address })]);
    const c = await place(u, { key, address });
    expect(a.order_id).toBe(b.order_id);
    expect(c.order_id).toBe(a.order_id);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(c.created).toBe(false);
    expect(await admin(`select 1 from public.orders where user_id = $1`, [u.id])).toHaveLength(1);
    expect((await stock(cat.abutmentVariantId)).reserved - before.reserved).toBe(1);
  });

  it('pedidos concurrentes no sobrevenden el último stock', async () => {
    const one = await newCustomer();
    const two = await newCustomer();
    await add(one.u, cat.implantVariants.d35l10, 2);
    await add(two.u, cat.implantVariants.d35l10, 2);
    const results = await Promise.allSettled([
      place(one.u, { address: one.address }),
      place(two.u, { address: two.address }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0]!.reason as Error).message).toBe('OUT_OF_STOCK');
    const s = await stock(cat.implantVariants.d35l10);
    expect(s).toEqual({ on_hand: 3, reserved: 2, committed: 0 });
  });

  it('exige correo confirmado', async () => {
    const { u, address } = await newCustomer({ confirmed: false });
    await add(u, cat.abutmentVariantId);
    await expectDbError(place(u, { address }), { message: 'EMAIL_NOT_CONFIRMED' });
  });

  it('exige aceptar la versión vigente de los términos', async () => {
    const [doc] = await admin<{ id: string }>(
      `insert into public.legal_documents (kind, version, title, url, published_at, is_current)
       values ('privacy', 'test-${suffix()}', 'Privacidad (prueba)', 'https://example.invalid/p', now(), true) returning id`);
    try {
      const { u, address } = await newCustomer();
      await add(u, cat.abutmentVariantId);
      await expectDbError(place(u, { address }), { message: 'TERMS_NOT_ACCEPTED' });
      await query(u.actor, `select public.accept_current_legal_documents()`);
      expect((await place(u, { address })).created).toBe(true);
    } finally {
      await admin(`update public.legal_documents set is_current = false where id = $1`, [doc!.id]);
    }
  });

  it('factura: exige datos de facturación y calcula en modo neto', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 3);
    await expectDbError(place(u, { doc: 'factura', address }), { message: 'BILLING_REQUIRED' });
    const [b] = await query<{ id: string }>(u.actor,
      `insert into public.billing_profiles (user_id, rut, business_name, giro, address_line, comuna_code, dte_email)
       values ($1, '76.086.428-5', 'Clínica de Prueba SpA', 'Servicios odontológicos', 'Av. Prueba 100', '13101', 'dte@prueba.invalid')
       returning id`, [u.id]);
    const r = await place(u, { doc: 'factura', address, billing: b!.id });
    const expected = computeTotals({ priceMode: 'net', taxRateBp: 1900, shippingNet: 4990,
      lines: [{ unitPriceNet: 45990, quantity: 3, taxClass: 'iva' }] });
    expect(r.total).toBe(expected.total);
    const [o] = await admin<{ price_mode: string; billing_snapshot: { business_name: string } }>(
      `select price_mode, billing_snapshot from public.orders where id = $1`, [r.order_id]);
    expect(o).toMatchObject({ price_mode: 'net', billing_snapshot: { business_name: 'Clínica de Prueba SpA' } });
  });

  it('limita los pedidos pendientes de pago por usuario', async () => {
    await setSetting('checkout.max_pending_orders', 1);
    try {
      const { u, address } = await newCustomer();
      await add(u, cat.abutmentVariantId);
      await place(u, { address });
      await add(u, cat.abutmentVariantId);
      await expectDbError(place(u, { address }), { message: 'RATE_LIMITED' });
    } finally {
      await setSetting('checkout.max_pending_orders', 5);
    }
  });
});

describe('historial y aislamiento de pedidos (criterios 2, 3 y 18)', () => {
  it('el pedido queda asociado a la cuenta y se consulta desde otra sesión; otros no lo ven', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId);
    const r = await place(u, { address });
    // "Otro dispositivo": nueva conexión y nueva transacción con el mismo usuario.
    const fromOtherDevice = await query<{ id: string }>({ kind: 'user', id: u.id },
      `select o.id from public.orders o join public.order_items i on i.order_id = o.id where o.id = $1`, [r.order_id]);
    expect(fromOtherDevice).toHaveLength(1);
    const { u: other } = await newCustomer();
    expect(await query(other.actor, `select id from public.orders where id = $1`, [r.order_id])).toEqual([]);
    expect(await query(other.actor, `select id from public.order_items where order_id = $1`, [r.order_id])).toEqual([]);
    expect(await query({ kind: 'anon' }, `select id from public.orders`)).toEqual([]);
    await expectDbError(query(other.actor, `select public.cancel_my_order($1)`, [r.order_id]), { message: 'ORDER_NOT_FOUND' });
  });

  it('los ítems del pedido son inmutables (precios históricos)', async () => {
    const [item] = await admin<{ id: string }>(`select id from public.order_items limit 1`);
    await expectDbError(admin(`update public.order_items set unit_price_net = 1 where id = $1`, [item!.id]), { message: 'IMMUTABLE_RECORD' });
    await expectDbError(admin(`delete from public.order_items where id = $1`, [item!.id]), { message: 'IMMUTABLE_RECORD' });
  });
});

describe('cancelación y vencimiento de reservas (CAR-06)', () => {
  it('el cliente cancela un pedido pendiente y se libera la reserva', async () => {
    const { u, address } = await newCustomer();
    const before = await stock(cat.abutmentVariantId);
    await add(u, cat.abutmentVariantId, 4);
    const r = await place(u, { address });
    expect((await stock(cat.abutmentVariantId)).reserved).toBe(before.reserved + 4);
    await query(u.actor, `select public.cancel_my_order($1)`, [r.order_id]);
    expect((await orderRow(r.order_id)).status).toBe('cancelled');
    expect((await stock(cat.abutmentVariantId)).reserved).toBe(before.reserved);
    await expectDbError(query(u.actor, `select public.cancel_my_order($1)`, [r.order_id]), { message: 'ORDER_NOT_CANCELLABLE' });
  });

  it('el job libera reservas vencidas y cancela el pedido', async () => {
    const { u, address } = await newCustomer();
    const before = await stock(cat.abutmentVariantId);
    await add(u, cat.abutmentVariantId, 2);
    const r = await place(u, { address });
    await admin(`update public.orders set reservation_expires_at = now() - interval '1 minute' where id = $1`, [r.order_id]);
    const [res] = await query<{ n: number }>(service, `select public.release_expired_reservations() as n`);
    expect(res!.n).toBeGreaterThanOrEqual(1);
    const [o] = await admin<{ status: string; cancel_reason: string }>(`select status, cancel_reason from public.orders where id = $1`, [r.order_id]);
    expect(o).toEqual({ status: 'cancelled', cancel_reason: 'Reserva vencida sin pago' });
    expect((await stock(cat.abutmentVariantId)).reserved).toBe(before.reserved);
  });
});

describe('pagos (PAG-02..05)', () => {
  async function pendingOrder(qty = 1, variant = cat.abutmentVariantId) {
    const { u, address } = await newCustomer();
    await add(u, variant, qty);
    const r = await place(u, { address });
    return { u, r };
  }

  it('solo el servicio crea intentos de pago, con el monto calculado por el servidor', async () => {
    const { u, r } = await pendingOrder();
    await expectDbError(query(u.actor, `select public.create_payment_attempt($1, 'x')`, [r.order_id]), { code: '42501' });
    const p = await payAttempt(r.order_id);
    expect(p.amount).toBe(r.total);
    expect(p.buy_order).toMatch(/^[A-Za-z0-9]{1,26}$/);
  });

  it('un monto aprobado distinto NO marca el pedido como pagado y genera revisión/reembolso', async () => {
    const { r } = await pendingOrder();
    const p = await payAttempt(r.order_id);
    const res = await applyPayment(p.payment_id, 'approved', p.amount - 100);
    expect(res).toMatchObject({ applied: false, result: 'amount_mismatch', payment_status: 'error', order_status: 'pending_payment' });
    expect(await admin(`select 1 from public.refunds where payment_id = $1`, [p.payment_id])).toHaveLength(1);
  });

  it('pago aprobado: pedido pagado, reserva → comprometido; eventos idempotentes', async () => {
    const before = await stock(cat.abutmentVariantId);
    const { u, r } = await pendingOrder(2);
    const p = await payAttempt(r.order_id);
    const eventId = `evt-${suffix()}`;
    const res = await applyPayment(p.payment_id, 'approved', p.amount, eventId);
    expect(res).toMatchObject({ applied: true, result: 'applied', payment_status: 'approved', order_status: 'paid' });
    expect(await orderRow(r.order_id)).toMatchObject({ status: 'paid', payment_status: 'paid' });
    const s = await stock(cat.abutmentVariantId);
    expect(s.reserved).toBe(before.reserved);
    expect(s.committed).toBe(before.committed + 2);

    const again = await applyPayment(p.payment_id, 'approved', p.amount, eventId);
    expect(again).toMatchObject({ applied: false, duplicate: true });
    expect((await stock(cat.abutmentVariantId)).committed).toBe(before.committed + 2);

    const [pay] = await query<{ status: string; card_last4: string }>(u.actor,
      `select status, card_last4 from public.payments where order_id = $1`, [r.order_id]);
    expect(pay).toEqual({ status: 'approved', card_last4: '6623' });
    // El cliente no ve los eventos crudos del proveedor.
    expect(await query(u.actor, `select 1 from public.payment_events where payment_id = $1`, [p.payment_id])).toEqual([]);
  });

  it('pago rechazado: el pedido sigue pendiente y se puede reintentar', async () => {
    const { r } = await pendingOrder();
    const p1 = await payAttempt(r.order_id);
    expect(await applyPayment(p1.payment_id, 'rejected', p1.amount)).toMatchObject({ order_status: 'pending_payment' });
    const p2 = await payAttempt(r.order_id);
    expect(await applyPayment(p2.payment_id, 'approved', p2.amount)).toMatchObject({ order_status: 'paid' });
  });

  it('transiciones inválidas no tienen efecto', async () => {
    const { r } = await pendingOrder();
    const p = await payAttempt(r.order_id);
    await applyPayment(p.payment_id, 'approved', p.amount);
    expect(await applyPayment(p.payment_id, 'pending', p.amount)).toMatchObject({ applied: false, result: 'invalid_transition', payment_status: 'approved' });
  });

  it('pago duplicado para un pedido ya pagado genera solicitud de reembolso', async () => {
    const { r } = await pendingOrder();
    const p1 = await payAttempt(r.order_id);
    const p2 = await payAttempt(r.order_id);
    await applyPayment(p1.payment_id, 'approved', p1.amount);
    const res = await applyPayment(p2.payment_id, 'approved', p2.amount);
    expect(res.result).toBe('applied_duplicate_refund_required');
    expect(await admin(`select reason from public.refunds where payment_id = $1`, [p2.payment_id])).toHaveLength(1);
  });

  it('pago tardío con stock disponible: el pedido vencido se reabre como pagado', async () => {
    const before = await stock(cat.abutmentVariantId);
    const { r } = await pendingOrder();
    const p = await payAttempt(r.order_id);
    await admin(`update public.orders set reservation_expires_at = now() - interval '1 minute' where id = $1`, [r.order_id]);
    await query(service, `select public.release_expired_reservations()`);
    expect((await orderRow(r.order_id)).status).toBe('cancelled');
    const [pay] = await admin<{ status: string }>(`select status from public.payments where id = $1`, [p.payment_id]);
    expect(pay!.status).toBe('expired');

    const res = await applyPayment(p.payment_id, 'approved', p.amount);
    expect(res).toMatchObject({ result: 'applied_late_reopened', payment_status: 'approved', order_status: 'paid' });
    const s = await stock(cat.abutmentVariantId);
    expect(s.committed).toBe(before.committed + 1);
    expect(s.reserved).toBe(before.reserved);
  });

  it('pago tardío sin stock: el pedido sigue cancelado y se solicita reembolso', async () => {
    // Tras la prueba de concurrencia queda 1 unidad disponible de Ø3.5×10.
    const [avail] = await admin<{ q: number }>(`select private.available_qty($1) as q`, [cat.implantVariants.d35l10]);
    expect(avail!.q).toBe(1);
    const { r } = await pendingOrder(1, cat.implantVariants.d35l10);
    const p = await payAttempt(r.order_id);
    await admin(`update public.orders set reservation_expires_at = now() - interval '1 minute' where id = $1`, [r.order_id]);
    await query(service, `select public.release_expired_reservations()`);
    // Otro cliente compra la última unidad antes de que llegue la confirmación del pago.
    const third = await newCustomer();
    await add(third.u, cat.implantVariants.d35l10, 1);
    await place(third.u, { address: third.address });

    const res = await applyPayment(p.payment_id, 'approved', p.amount);
    expect(res.result).toBe('applied_late_refund_required');
    expect(await orderRow(r.order_id)).toMatchObject({ status: 'cancelled', payment_status: 'paid' });
    const refunds = await admin<{ amount: number; status: string }>(`select amount, status from public.refunds where payment_id = $1`, [p.payment_id]);
    expect(refunds).toEqual([{ amount: p.amount, status: 'requested' }]);
  });
});

describe('despacho, lotes y trazabilidad (DES-02, DES-03, INV-05)', () => {
  it('despacha con FEFO, descuenta stock, registra lotes y permite rastrear el lote', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.implantVariants.d40l10, 3);
    const r = await place(u, { address });
    const p = await payAttempt(r.order_id);
    await applyPayment(p.payment_id, 'approved', p.amount);
    const before = await stock(cat.implantVariants.d40l10);

    // Un cliente no puede despachar.
    await expectDbError(query(u.actor, `select public.fulfill_order($1, null, 'X')`, [r.order_id]), { message: 'PERMISSION_DENIED' });

    const [f] = await query<{ id: string }>(staff.actor,
      `select public.fulfill_order($1, null, 'Transportista de prueba', 'TRK-PRUEBA-1', 'https://example.invalid/t/1', current_date + 2) as id`,
      [r.order_id]);
    const after = await stock(cat.implantVariants.d40l10);
    expect(after.on_hand).toBe(before.on_hand - 3);
    expect(after.committed).toBe(before.committed - 3);

    // El cliente ve qué lotes recibió (para su registro); FEFO despacha primero el que vence antes.
    const alloc = await query<{ lot_number: string; quantity: number }>(u.actor,
      `select l.lot_number, a.quantity from public.order_allocations a join public.inventory_lots l on l.id = a.lot_id
        where a.order_id = $1 order by l.expiry_date`, [r.order_id]);
    expect(alloc).toEqual([{ lot_number: 'L2-2029', quantity: 2 }, { lot_number: 'L1-2030', quantity: 1 }]);
    const { u: other } = await newCustomer();
    expect(await query(other.actor, `select 1 from public.inventory_lots where variant_id = $1`, [cat.implantVariants.d40l10])).toEqual([]);

    const [lot] = await admin<{ id: string }>(`select id from public.inventory_lots where lot_number = 'L2-2029' and variant_id = $1`,
      [cat.implantVariants.d40l10]);
    const traced = await query<{ order_number: string; quantity: number }>(staff.actor, `select * from public.find_orders_by_lot($1)`, [lot!.id]);
    expect(traced).toEqual([expect.objectContaining({ order_number: r.order_number, quantity: 2 })]);

    const [o] = await query<{ status: string; fulfillment_status: string }>(u.actor,
      `select status, fulfillment_status from public.orders where id = $1`, [r.order_id]);
    expect(o).toEqual({ status: 'shipped', fulfillment_status: 'fulfilled' });
    const [sh] = await query<{ tracking_number: string; status: string; delivered_at: Date | null }>(u.actor,
      `select tracking_number, status, delivered_at from public.shipments where id = $1`, [f!.id]);
    expect(sh).toEqual({ tracking_number: 'TRK-PRUEBA-1', status: 'in_transit', delivered_at: null });

    await query(staff.actor, `select public.add_shipment_event($1, 'delivered', 'Recibido por el cliente')`, [f!.id]);
    const final = await orderRow(r.order_id);
    expect(final.status).toBe('delivered');
    const events = await query<{ status: string }>(u.actor, `select status from public.shipment_events where shipment_id = $1 order by id`, [f!.id]);
    expect(events.map((e) => e.status)).toEqual(['in_transit', 'delivered']);
  });

  it('retiro en bodega: sin dirección, despacho gratis y listo para retiro', async () => {
    const { u } = await newCustomer();
    await add(u, cat.abutmentVariantId, 1);
    const s = await summary(u, { method: 'pickup', pickup: cat.warehouseId });
    expect(s.shipping).toMatchObject({ available: true, price_net: 0 });
    const r = await place(u, { method: 'pickup', pickup: cat.warehouseId });
    const p = await payAttempt(r.order_id);
    await applyPayment(p.payment_id, 'approved', p.amount);
    await query(staff.actor, `select public.fulfill_order($1)`, [r.order_id]);
    expect((await orderRow(r.order_id)).status).toBe('ready_for_pickup');
    await query(staff.actor, `select public.update_order_status($1, 'delivered', 'Retirado en bodega')`, [r.order_id]);
    expect((await orderRow(r.order_id)).status).toBe('delivered');
  });

  it('el personal no puede saltarse estados ni marcar pagado manualmente', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 1);
    const r = await place(u, { address });
    await expectDbError(query(staff.actor, `select public.update_order_status($1, 'paid')`, [r.order_id]), { message: 'INVALID_STATUS_TRANSITION' });
    await expectDbError(query(staff.actor, `select public.update_order_status($1, 'delivered')`, [r.order_id]), { message: 'INVALID_STATUS_TRANSITION' });
  });

  it('cancelar un pedido pagado libera el stock comprometido y solicita reembolso', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 2);
    const r = await place(u, { address });
    const p = await payAttempt(r.order_id);
    await applyPayment(p.payment_id, 'approved', p.amount);
    const before = await stock(cat.abutmentVariantId);
    await expectDbError(query(staff.actor, `select public.update_order_status($1, 'cancelled')`, [r.order_id]), { message: 'REASON_REQUIRED' });
    await query(staff.actor, `select public.update_order_status($1, 'cancelled', 'Solicitado por el cliente')`, [r.order_id]);
    expect((await stock(cat.abutmentVariantId)).committed).toBe(before.committed - 2);
    const refunds = await admin<{ amount: number; status: string }>(`select amount, status from public.refunds where order_id = $1`, [r.order_id]);
    expect(refunds).toEqual([{ amount: p.amount, status: 'requested' }]);
  });
});

describe('eliminación de cuenta (CTA-12)', () => {
  it('no permite eliminar con pedidos en curso; luego elimina y conserva el pedido desvinculado', async () => {
    const { u, address } = await newCustomer();
    await add(u, cat.abutmentVariantId, 1);
    const r = await place(u, { address });
    await expectDbError(query(u.actor, `select public.delete_my_account()`), { message: 'ACCOUNT_HAS_OPEN_ORDERS' });
    await query(u.actor, `select public.cancel_my_order($1)`, [r.order_id]);
    await query(u.actor, `select public.delete_my_account()`);
    expect(await admin(`select 1 from auth.users where id = $1`, [u.id])).toEqual([]);
    expect(await admin(`select 1 from public.profiles where id = $1`, [u.id])).toEqual([]);
    expect(await admin(`select 1 from public.addresses where user_id = $1`, [u.id])).toEqual([]);
    const o = await orderRow(r.order_id);
    expect(o.user_id).toBeNull();
    expect(await admin(`select 1 from public.audit_log where action = 'account.deleted' and record_id = $1`, [u.id])).toHaveLength(1);
  });
});
