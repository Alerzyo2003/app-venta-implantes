/** Nombres de los roles del sistema (tabla public.roles, migración 0700). */
const SYSTEM_ROLE_LABELS: Record<string, string> = {
  admin_general: 'Administrador general',
  admin_comercial: 'Administrador comercial',
  vendedor: 'Vendedor',
  inventario: 'Encargado de inventario',
  despacho: 'Encargado de despacho',
  compras: 'Responsable de compras',
  soporte: 'Soporte',
};

export function roleLabel(code: string): string {
  return SYSTEM_ROLE_LABELS[code] ?? code;
}
