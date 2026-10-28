'use server';

import { revalidatePath } from 'next/cache';

import { authorizeAction } from '@/lib/auth/dal';
import { isUuid } from '@/lib/data/catalog';
import { dbErrorMessage } from '@/lib/db-errors';
import { failure, formText, formValues, invalid, success, type FormState } from '@/lib/forms';
import { adjustSchema, LOT_STATUS_LABELS, lotStatusSchema, receiveSchema } from '@/lib/schemas/inventory';

function revalidateInventory(variantId: string) {
  revalidatePath('/inventario');
  revalidatePath(`/inventario/${variantId}`);
  revalidatePath('/inventario/movimientos');
  revalidatePath('/');
}

/** Ingreso manual de mercadería (public.inventory_receive: permisos, lote y vencimiento en la base). */
export async function receiveStock(variantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeAction('inventory.receive');
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(variantId)) return failure('Solicitud no válida.');
  const values = formValues(formData);
  const parsed = receiveSchema.safeParse({
    warehouseId: formText(formData, 'warehouseId'),
    quantity: formText(formData, 'quantity'),
    lotNumber: formText(formData, 'lotNumber'),
    expiryDate: formText(formData, 'expiryDate'),
    reason: formText(formData, 'reason'),
    requestId: formText(formData, 'requestId'),
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const d = parsed.data;

  const { error } = await auth.ctx.supabase.rpc('inventory_receive', {
    p_variant_id: variantId,
    p_warehouse_id: d.warehouseId,
    p_quantity: d.quantity,
    p_lot_number: d.lotNumber,
    p_expiry_date: d.expiryDate,
    p_reason: d.reason,
    p_request_id: d.requestId,
  });
  if (error) return failure(dbErrorMessage(error), values);
  revalidateInventory(variantId);
  return success(`Ingreso registrado: ${d.quantity} unidad(es).`);
}

/** Ajuste con motivo obligatorio; para productos con lote se indica el lote afectado. */
export async function adjustStock(variantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeAction('inventory.adjust');
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(variantId)) return failure('Solicitud no válida.');
  const values = formValues(formData);
  const parsed = adjustSchema.safeParse({
    warehouseId: formText(formData, 'warehouseId'),
    direction: formText(formData, 'direction'),
    quantity: formText(formData, 'quantity'),
    lotId: formText(formData, 'lotId'),
    reason: formText(formData, 'reason'),
    requestId: formText(formData, 'requestId'),
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const d = parsed.data;
  const delta = d.direction === 'in' ? d.quantity : -d.quantity;

  const { error } = await auth.ctx.supabase.rpc('inventory_adjust', {
    p_variant_id: variantId,
    p_warehouse_id: d.warehouseId,
    p_delta: delta,
    p_reason: d.reason,
    p_lot_id: d.lotId,
    p_request_id: d.requestId,
  });
  if (error) return failure(dbErrorMessage(error), values);
  revalidateInventory(variantId);
  return success(`Ajuste registrado: ${delta > 0 ? '+' : ''}${delta} unidad(es).`);
}

/** Cuarentena, retiro de mercado o vencimiento de un lote (motivo auditado en la base). */
export async function changeLotStatus(
  variantId: string,
  lotId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeAction('inventory.lots');
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(variantId) || !isUuid(lotId)) return failure('Solicitud no válida.');
  const values = formValues(formData);
  const parsed = lotStatusSchema.safeParse({ status: formText(formData, 'status'), reason: formText(formData, 'reason') });
  if (!parsed.success) return invalid(parsed.error, values);

  // El lote debe pertenecer a la variante de la página (no se confía en el formulario).
  const { data: lot, error: lotError } = await auth.ctx.supabase
    .from('inventory_lots')
    .select('id')
    .eq('id', lotId)
    .eq('variant_id', variantId)
    .maybeSingle();
  if (lotError) return failure(dbErrorMessage(lotError), values);
  if (!lot) return failure('El lote no existe.', values);

  const { error } = await auth.ctx.supabase.rpc('set_lot_status', {
    p_lot_id: lotId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(dbErrorMessage(error), values);
  revalidateInventory(variantId);
  return success(`Estado del lote actualizado: ${LOT_STATUS_LABELS[parsed.data.status]}.`);
}
