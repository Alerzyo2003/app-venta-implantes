/**
 * Máquinas de estado de pedidos, pagos y envíos. Deben coincidir con las funciones SQL
 * (`private.order_transition_allowed`, `private.payment_transition_allowed`); las pruebas
 * de la base de datos verifican la misma tabla de transiciones.
 */

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'preparing',
  'ready_for_pickup',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['preparing', 'cancelled'],
  preparing: ['shipped', 'ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['delivered'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  pending_payment: 'Pendiente de pago',
  paid: 'Pagado',
  preparing: 'En preparación',
  ready_for_pickup: 'Listo para retiro',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function isOrderFinal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

export const PAYMENT_STATUSES = [
  'created',
  'pending',
  'authorized',
  'approved',
  'rejected',
  'cancelled',
  'expired',
  'error',
  'partially_refunded',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  created: ['pending', 'authorized', 'approved', 'rejected', 'cancelled', 'expired', 'error'],
  pending: ['authorized', 'approved', 'rejected', 'cancelled', 'expired', 'error'],
  authorized: ['approved', 'cancelled', 'expired'],
  error: ['pending', 'approved', 'rejected', 'cancelled', 'expired'],
  approved: ['partially_refunded', 'refunded'],
  partially_refunded: ['partially_refunded', 'refunded'],
  rejected: [],
  // El proveedor confirma dinero capturado después de dar el intento por vencido/anulado:
  // se registra y se aplica la lógica de pago tardío (reabrir o reembolsar).
  cancelled: ['approved'],
  expired: ['approved'],
  refunded: [],
};

export const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  created: 'Creado',
  pending: 'Pendiente',
  authorized: 'Autorizado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Anulado',
  expired: 'Expirado',
  error: 'Error',
  partially_refunded: 'Reembolsado parcialmente',
  refunded: 'Reembolsado',
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export const ORDER_PAYMENT_STATUSES = ['unpaid', 'paid', 'partially_refunded', 'refunded'] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const ORDER_PAYMENT_STATUS_LABELS: Readonly<Record<OrderPaymentStatus, string>> = {
  unpaid: 'Sin pago',
  paid: 'Pagado',
  partially_refunded: 'Reembolsado parcialmente',
  refunded: 'Reembolsado',
};

export const SHIPMENT_STATUSES = [
  'pending',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'incident',
  'returned',
  'cancelled',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Readonly<Record<ShipmentStatus, string>> = {
  pending: 'Pendiente de envío',
  in_transit: 'En tránsito',
  out_for_delivery: 'En reparto',
  delivered: 'Entregado',
  incident: 'Con incidencia',
  returned: 'Devuelto',
  cancelled: 'Anulado',
};
