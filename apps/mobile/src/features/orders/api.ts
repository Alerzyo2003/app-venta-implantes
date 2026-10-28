import type { DocumentType, OrderPaymentStatus, OrderStatus, PaymentStatus, ShipmentStatus } from '@repo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase, supabase } from '@/lib/supabase';

export interface OrderListItem {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
  total: number;
  placed_at: string;
  document_type: DocumentType;
}

/** Historial permanente desde el servidor (CTA-10); RLS devuelve solo los pedidos propios. */
export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<OrderListItem[]> => {
      const { data, error } = await getSupabase()
        .from('orders')
        .select('id, order_number, status, payment_status, total, placed_at, document_type')
        .order('placed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as OrderListItem[];
    },
  });
}

export interface OrderDetail extends OrderListItem {
  price_mode: 'net' | 'gross';
  subtotal_net: number;
  discount_net: number;
  shipping_net: number;
  shipping_gross: number;
  taxable_net: number;
  exempt_net: number;
  tax_amount: number;
  shipping_method_code: string;
  shipping_snapshot: { method_name: string; est_days_min: number; est_days_max: number; pickup_point?: { name: string; address_line: string | null } | null };
  shipping_address_snapshot: {
    recipient_name: string;
    street: string;
    street_number: string;
    unit: string | null;
    comuna: string;
    region: string;
  } | null;
  billing_snapshot: { business_name: string; rut: string } | null;
  estimated_delivery_min: string | null;
  estimated_delivery_max: string | null;
  reservation_expires_at: string | null;
  cancel_reason: string | null;
  delivered_at: string | null;
  items: {
    id: string;
    line_no: number;
    sku: string;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price_net: number;
    unit_price_gross: number;
    line_total: number;
  }[];
  history: { id: number; from_status: OrderStatus | null; to_status: OrderStatus; reason: string | null; created_at: string }[];
  payments: { id: string; status: PaymentStatus; amount: number; method: string | null; card_last4: string | null; approved_at: string | null; created_at: string }[];
  shipments: {
    id: string;
    carrier: string;
    tracking_number: string | null;
    tracking_url: string | null;
    status: ShipmentStatus;
    estimated_delivery_date: string | null;
    delivered_at: string | null;
    events: { id: number; status: string; description: string | null; occurred_at: string }[];
  }[];
}

export function useOrder(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['order', user?.id, id],
    enabled: !!supabase && !!user && !!id,
    queryFn: async (): Promise<OrderDetail | null> => {
      const { data, error } = await getSupabase()
        .from('orders')
        .select(
          `*,
          items:order_items!order_items_order_id_fkey(id, line_no, sku, product_name, variant_label, quantity, unit_price_net, unit_price_gross, line_total),
          history:order_status_history!order_status_history_order_id_fkey(id, from_status, to_status, reason, created_at),
          payments:payments!payments_order_id_fkey(id, status, amount, method, card_last4, approved_at, created_at),
          shipments:shipments!shipments_order_id_fkey(id, carrier, tracking_number, tracking_url, status, estimated_delivery_date, delivered_at,
            events:shipment_events!shipment_events_shipment_id_fkey(id, status, description, occurred_at))`,
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const order = data as unknown as OrderDetail;
      order.items.sort((a, b) => a.line_no - b.line_no);
      order.history.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return order;
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await getSupabase().rpc('cancel_my_order', { p_order_id: orderId });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
    },
  });
}
