import type { Permission } from '@repo/domain';

import { canAny, type PermissionHolder } from '@/lib/auth/access';

export type NavIcon = 'home' | 'products' | 'inventory' | 'movements' | 'warehouses';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Basta con uno de estos permisos para ver la sección (vacío = todo el personal). */
  anyOf: readonly Permission[];
}

/** Solo secciones implementadas: no se muestran accesos a módulos que aún no existen. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Inicio', icon: 'home', anyOf: [] },
  { href: '/productos', label: 'Productos', icon: 'products', anyOf: ['catalog.read'] },
  { href: '/inventario', label: 'Inventario', icon: 'inventory', anyOf: ['inventory.read'] },
  { href: '/inventario/movimientos', label: 'Movimientos', icon: 'movements', anyOf: ['inventory.read'] },
  { href: '/bodegas', label: 'Bodegas', icon: 'warehouses', anyOf: ['inventory.read'] },
];

export function navFor(holder: PermissionHolder): NavItem[] {
  return NAV_ITEMS.filter((item) => canAny(holder, item.anyOf));
}

/** Sección activa: la de ruta más específica que contiene la actual. */
export function activeHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    const matches = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
