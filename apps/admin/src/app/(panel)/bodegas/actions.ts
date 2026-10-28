'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { authorizeAction } from '@/lib/auth/dal';
import { isUuid } from '@/lib/data/catalog';
import { dbErrorMessage } from '@/lib/db-errors';
import { failure, formValues, invalid, success, type FormState } from '@/lib/forms';
import { readWarehouseForm, warehouseSchema } from '@/lib/schemas/inventory';

function warehouseRow(d: ReturnType<typeof warehouseSchema.parse>) {
  return {
    code: d.code,
    name: d.name,
    address_line: d.addressLine,
    comuna_code: d.comunaCode,
    is_active: d.isActive,
    is_sellable: d.isSellable,
    is_pickup_point: d.isPickupPoint,
    priority: d.priority,
  };
}

export async function saveWarehouse(warehouseId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeAction('warehouses.manage');
  if (!auth.ok) return failure(auth.message);
  if (warehouseId !== null && !isUuid(warehouseId)) return failure('Solicitud no válida.');
  const values = formValues(formData);
  const parsed = warehouseSchema.safeParse(readWarehouseForm(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const db = auth.ctx.supabase;
  const result = warehouseId
    ? await db.from('warehouses').update(warehouseRow(parsed.data)).eq('id', warehouseId).select('id').single()
    : await db.from('warehouses').insert(warehouseRow(parsed.data)).select('id').single();
  if (result.error) return failure(dbErrorMessage(result.error), values);
  revalidatePath('/bodegas');
  revalidatePath('/inventario');
  if (!warehouseId) redirect('/bodegas?creada=1');
  revalidatePath(`/bodegas/${warehouseId}`);
  return success('Bodega actualizada.');
}
