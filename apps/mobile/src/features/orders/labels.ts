import type { OrderStatus } from '@repo/domain';

import type { BadgeTone } from '@/components/ui';

export const ORDER_TONE: Record<OrderStatus, BadgeTone> = {
  pending_payment: 'warning',
  paid: 'info',
  preparing: 'info',
  ready_for_pickup: 'accent',
  shipped: 'accent',
  delivered: 'success',
  cancelled: 'neutral',
};
