import type { AvailabilityStatus, DocumentType } from '@repo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase, supabase } from '@/lib/supabase';

export interface CartItem {
  cart_item_id: string;
  variant_id: string;
  product_id: string;
  product_slug: string;
  sku: string;
  manufacturer_ref: string | null;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  tax_class: 'iva' | 'exempt';
  requires_professional: boolean;
  availability: AvailabilityStatus;
  available_qty: number | null;
  issue: string | null;
  unit_price_net: number | null;
}

export interface CartTotals {
  price_mode: 'net' | 'gross';
  lines: { unit_price_gross: number; line_total: number; line_net: number; quantity: number }[];
  subtotal_net: number;
  shipping_net: number;
  shipping_gross: number;
  taxable_net: number;
  exempt_net: number;
  tax_amount: number;
  total: number;
}

export interface CartSummary {
  cart_id: string | null;
  item_count: number;
  items: CartItem[];
  price_visible: boolean;
  document_type: DocumentType;
  price_mode: 'net' | 'gross';
  shipping: { method_code: string; available: boolean; price_net?: number; est_days_min?: number; est_days_max?: number; issue?: string } | null;
  totals: CartTotals | null;
  issues: string[];
  can_checkout: boolean;
}

export interface CartSummaryParams {
  documentType?: DocumentType;
  shippingMethodCode?: string | null;
  addressId?: string | null;
  pickupWarehouseId?: string | null;
}

/** Cotización del carrito calculada SIEMPRE por el servidor (CAR-03). */
export function useCartSummary(params: CartSummaryParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cart-summary', user?.id, params],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<CartSummary> => {
      const { data, error } = await getSupabase().rpc('get_cart_summary', {
        p_document_type: params.documentType ?? 'boleta',
        p_shipping_method_code: params.shippingMethodCode ?? null,
        p_address_id: params.addressId ?? null,
        p_pickup_warehouse_id: params.pickupWarehouseId ?? null,
      });
      if (error) throw error;
      return data as CartSummary;
    },
  });
}

function useInvalidateCart() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cart-summary'] });
}

export function useAddToCart() {
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: async ({ variantId, quantity }: { variantId: string; quantity: number }) => {
      const { error } = await getSupabase().rpc('cart_add_item', { p_variant_id: variantId, p_quantity: quantity });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetCartItem() {
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: async ({ variantId, quantity }: { variantId: string; quantity: number }) => {
      const { error } = await getSupabase().rpc('cart_set_item', { p_variant_id: variantId, p_quantity: quantity });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
