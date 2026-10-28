/** Estado de disponibilidad que se muestra al cliente (el número exacto lo decide el servidor). */

export type AvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const AVAILABILITY_LABELS: Readonly<Record<AvailabilityStatus, string>> = {
  in_stock: 'Disponible',
  low_stock: 'Últimas unidades',
  out_of_stock: 'Agotado',
};

export function availabilityFromQuantity(
  available: number,
  lowStockThreshold: number,
): AvailabilityStatus {
  if (!Number.isFinite(available) || available <= 0) return 'out_of_stock';
  if (available <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
