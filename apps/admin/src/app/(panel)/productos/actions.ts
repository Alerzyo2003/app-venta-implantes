'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { authorizeAction, type StaffContext } from '@/lib/auth/dal';
import { isUuid } from '@/lib/data/catalog';
import { dbErrorMessage } from '@/lib/db-errors';
import { failure, formValues, invalid, success, type FormState } from '@/lib/forms';
import {
  PRODUCT_STATUSES,
  productRow,
  productSchema,
  readProductForm,
  readVariantForm,
  variantRow,
  variantSchema,
  type ProductStatus,
} from '@/lib/schemas/product';

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeAction('catalog.create');
  if (!auth.ok) return failure(auth.message);
  const values = formValues(formData);
  const parsed = productSchema.safeParse(readProductForm(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const { data, error } = await auth.ctx.supabase.from('products').insert(productRow(parsed.data)).select('id').single();
  if (error) return failure(dbErrorMessage(error), values);
  revalidatePath('/productos');
  redirect(`/productos/${(data as { id: string }).id}?creado=1`);
}

export async function updateProduct(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorizeAction('catalog.update');
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(productId)) return failure('El producto no existe.');
  const values = formValues(formData);
  const parsed = productSchema.safeParse(readProductForm(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const { error } = await auth.ctx.supabase
    .from('products')
    .update(productRow(parsed.data))
    .eq('id', productId)
    .select('id')
    .single();
  if (error) return failure(dbErrorMessage(error), values);
  revalidatePath('/productos');
  revalidatePath(`/productos/${productId}`);
  return success('Cambios guardados.');
}

/** Permiso que exige cada cambio de estado (la base vuelve a validarlo). */
function statusPermission(from: ProductStatus, to: ProductStatus) {
  if (to === 'archived' || from === 'archived') return 'catalog.delete' as const;
  if (to === 'published') return 'catalog.publish' as const;
  return 'catalog.update' as const;
}

export async function setProductStatus(productId: string, status: string, _prev: FormState): Promise<FormState> {
  if (!isUuid(productId) || !(PRODUCT_STATUSES as readonly string[]).includes(status)) {
    return failure('Solicitud no válida.');
  }
  const auth = await authorizeAction('catalog.update');
  if (!auth.ok) return failure(auth.message);
  const db = auth.ctx.supabase;
  const { data: current, error: readError } = await db.from('products').select('status').eq('id', productId).single();
  if (readError) return failure(dbErrorMessage(readError));
  const from = (current as { status: ProductStatus }).status;
  const to = status as ProductStatus;
  if (!auth.ctx.permissions.has(statusPermission(from, to))) {
    return failure('No tienes permiso para realizar esta acción.');
  }
  const { error } = await db.from('products').update({ status: to }).eq('id', productId).select('id').single();
  if (error) return failure(dbErrorMessage(error));
  revalidatePath('/productos');
  revalidatePath(`/productos/${productId}`);
  // El botón usado deja de existir con el nuevo estado: el aviso se muestra en la página.
  redirect(`/productos/${productId}?estado=${to}`);
}

async function saveBasePrice(ctx: StaffContext, variantId: string, priceNet: number): Promise<string | null> {
  const db = ctx.supabase;
  const { data: list, error: listError } = await db.from('price_lists').select('id').eq('is_default', true).single();
  if (listError) return dbErrorMessage(listError);
  const { error } = await db
    .from('price_list_items')
    .upsert(
      { price_list_id: (list as { id: string }).id, variant_id: variantId, min_quantity: 1, unit_price_net: priceNet },
      { onConflict: 'price_list_id,variant_id,min_quantity' },
    );
  return error ? dbErrorMessage(error) : null;
}

export async function saveVariant(
  productId: string,
  variantId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorizeAction(variantId ? 'catalog.update' : 'catalog.create');
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(productId) || (variantId !== null && !isUuid(variantId))) return failure('Solicitud no válida.');
  const values = formValues(formData);
  const parsed = variantSchema.safeParse(readVariantForm(formData));
  if (!parsed.success) return invalid(parsed.error, values);
  if (parsed.data.priceNet !== null && !auth.ctx.permissions.has('prices.update')) {
    return failure('No tienes permiso para modificar precios.', values);
  }

  const db = auth.ctx.supabase;
  const row = variantRow(parsed.data);
  const result = variantId
    ? await db.from('product_variants').update(row).eq('id', variantId).eq('product_id', productId).select('id').single()
    : await db.from('product_variants').insert({ ...row, product_id: productId }).select('id').single();
  if (result.error) return failure(dbErrorMessage(result.error), values);
  const savedId = (result.data as { id: string }).id;

  if (parsed.data.priceNet !== null) {
    const priceError = await saveBasePrice(auth.ctx, savedId, parsed.data.priceNet);
    if (priceError) {
      revalidatePath(`/productos/${productId}`);
      return failure(`La variante se guardó, pero el precio no: ${priceError}`);
    }
  }
  revalidatePath('/productos');
  revalidatePath(`/productos/${productId}`);
  redirect(`/productos/${productId}?variante=${variantId ? 'actualizada' : 'creada'}`);
}
