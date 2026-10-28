import 'server-only';

import { z } from 'zod';

import type { StaffContext } from '@/lib/auth/dal';

const count = z.coerce.number().int().nonnegative();

/** Respuesta de public.admin_dashboard_summary(): solo trae las secciones permitidas al usuario. */
export const summarySchema = z.object({
  products: z
    .object({ draft: count, published: count, archived: count, published_without_active_variant: count })
    .optional(),
  inventory: z
    .object({
      low_stock_threshold: count,
      expiry_warning_days: count,
      out_of_stock: count,
      low_stock: count,
      expiring_lots: count,
      expired_lots_with_stock: count,
      blocked_lots_with_stock: count,
    })
    .optional(),
  orders: z.record(z.string(), count).optional(),
  pending_verifications: count.optional(),
});
export type DashboardSummary = z.infer<typeof summarySchema>;

export async function getDashboardSummary(ctx: StaffContext): Promise<DashboardSummary> {
  const { data, error } = await ctx.supabase.rpc('admin_dashboard_summary');
  if (error) throw error;
  return summarySchema.parse(data);
}
