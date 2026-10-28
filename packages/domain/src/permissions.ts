/**
 * Permisos del sistema (tabla public.permissions, migración 0700). Las apps los usan solo para
 * adaptar la interfaz: la base de datos vuelve a validarlos en cada operación.
 * Una prueba de base de datos verifica que esta lista coincida con la tabla.
 */
export const PERMISSION_CODES = [
  'catalog.read',
  'catalog.create',
  'catalog.update',
  'catalog.delete',
  'catalog.publish',
  'catalog.import',
  'catalog.export',
  'compatibility.read',
  'compatibility.manage',
  'compatibility.verify',
  'prices.read',
  'prices.update',
  'costs.read',
  'costs.update',
  'inventory.read',
  'inventory.adjust',
  'inventory.receive',
  'inventory.lots',
  'warehouses.manage',
  'orders.read',
  'orders.update',
  'orders.cancel',
  'orders.export',
  'payments.read',
  'payments.approve',
  'refunds.create',
  'refunds.approve',
  'shipments.read',
  'shipments.update',
  'customers.read',
  'customers.update',
  'customers.export',
  'verifications.review',
  'organizations.read',
  'organizations.manage',
  'settings.read',
  'settings.update',
  'users.read',
  'users.manage_roles',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSION_CODES)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSION_CODES);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}
