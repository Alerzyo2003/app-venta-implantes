import { toAppError } from '@repo/domain';

/** Restricciones únicas y de validación de la base con su explicación para el personal. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  products_slug_key: 'Ya existe un producto con esa dirección web (slug). Usa otra.',
  products_slug_check: 'La dirección web (slug) solo admite minúsculas, números y guiones.',
  products_check: 'Para controlar vencimientos, el producto también debe controlar lotes.',
  products_name_check: 'El nombre debe tener entre 2 y 200 caracteres.',
  product_variants_sku_idx: 'Ya existe una variante con ese SKU.',
  product_variants_sku_check: 'El SKU debe tener entre 2 y 64 caracteres.',
  product_variants_gtin_idx: 'Ese GTIN ya está asignado a otra variante.',
  product_variants_gtin_check: 'El GTIN no es válido: revisa el dígito verificador.',
  product_variants_diameter_mm_check: 'El diámetro debe ser mayor que 0 y menor que 100 mm.',
  product_variants_length_mm_check: 'El largo debe ser mayor que 0 y menor que 1000 mm.',
  price_list_items_unit_price_net_check: 'El precio debe ser mayor que cero.',
  warehouses_code_key: 'Ya existe una bodega con ese código.',
  warehouses_code_check: 'El código de bodega admite de 2 a 20 mayúsculas, números, guiones o guiones bajos.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Mensaje en español para un error de Supabase/PostgreSQL. Los errores de negocio
 * (RAISE con código) usan los textos de @repo/domain; nunca se muestran detalles técnicos.
 */
export function dbErrorMessage(error: unknown): string {
  if (isRecord(error)) {
    const code = typeof error.code === 'string' ? error.code : '';
    const message = typeof error.message === 'string' ? error.message : '';
    const constraint = /constraint "([^"]+)"/.exec(message)?.[1];
    if (constraint && CONSTRAINT_MESSAGES[constraint]) return CONSTRAINT_MESSAGES[constraint];
    if (code === '23505') return 'Ya existe un registro con esos datos.';
    if (code === '23514') return 'Los datos no cumplen las reglas del catálogo. Revísalos.';
    if (code === '23503') return 'Uno de los datos relacionados ya no existe. Recarga la página e intenta nuevamente.';
    if (code === '22P02' || code === '22003' || code === '22001' || code === '22007') {
      return 'Revisa los datos ingresados: hay un valor con formato no válido.';
    }
  }
  return toAppError(error).message;
}
