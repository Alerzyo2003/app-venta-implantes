import { describe, expect, it } from 'vitest';
import {
  canTransitionOrder,
  canTransitionPayment,
  isOrderFinal,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
} from './status';

describe('máquina de estados del pedido', () => {
  it('permite el flujo normal de despacho', () => {
    expect(canTransitionOrder('pending_payment', 'paid')).toBe(true);
    expect(canTransitionOrder('paid', 'preparing')).toBe(true);
    expect(canTransitionOrder('preparing', 'shipped')).toBe(true);
    expect(canTransitionOrder('shipped', 'delivered')).toBe(true);
  });
  it('permite retiro en bodega', () => {
    expect(canTransitionOrder('preparing', 'ready_for_pickup')).toBe(true);
    expect(canTransitionOrder('ready_for_pickup', 'delivered')).toBe(true);
  });
  it('impide saltos y retrocesos', () => {
    expect(canTransitionOrder('pending_payment', 'shipped')).toBe(false);
    expect(canTransitionOrder('delivered', 'cancelled')).toBe(false);
    expect(canTransitionOrder('shipped', 'cancelled')).toBe(false);
    expect(canTransitionOrder('cancelled', 'paid')).toBe(false);
  });
  it('estados finales', () => {
    expect(isOrderFinal('delivered')).toBe(true);
    expect(isOrderFinal('cancelled')).toBe(true);
    expect(isOrderFinal('paid')).toBe(false);
  });
  it('todos los estados tienen etiqueta en español', () => {
    for (const s of ORDER_STATUSES) expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
  });
});

describe('máquina de estados del pago', () => {
  it('flujo aprobado y reembolso', () => {
    expect(canTransitionPayment('created', 'pending')).toBe(true);
    expect(canTransitionPayment('pending', 'approved')).toBe(true);
    expect(canTransitionPayment('approved', 'partially_refunded')).toBe(true);
    expect(canTransitionPayment('partially_refunded', 'refunded')).toBe(true);
  });
  it('los estados finales no retroceden', () => {
    expect(canTransitionPayment('approved', 'pending')).toBe(false);
    expect(canTransitionPayment('rejected', 'approved')).toBe(false);
    expect(canTransitionPayment('refunded', 'approved')).toBe(false);
  });
  it('todos los estados tienen etiqueta', () => {
    for (const s of PAYMENT_STATUSES) expect(PAYMENT_STATUS_LABELS[s]).toBeTruthy();
  });
});
