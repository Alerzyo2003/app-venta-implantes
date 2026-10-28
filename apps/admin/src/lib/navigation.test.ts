import { describe, expect, it } from 'vitest';

import { activeHref, NAV_ITEMS, navFor } from './navigation';

describe('navFor', () => {
  it('muestra solo las secciones permitidas', () => {
    const items = navFor({ permissions: new Set(['catalog.read']) });
    expect(items.map((i) => i.href)).toEqual(['/', '/productos']);
  });
  it('el inventario agrupa existencias, movimientos y bodegas', () => {
    const items = navFor({ permissions: new Set(['inventory.read']) });
    expect(items.map((i) => i.href)).toEqual(['/', '/inventario', '/inventario/movimientos', '/bodegas']);
  });
});

describe('activeHref', () => {
  it('elige la sección más específica', () => {
    expect(activeHref('/inventario/movimientos', NAV_ITEMS)).toBe('/inventario/movimientos');
    expect(activeHref('/inventario/abc', NAV_ITEMS)).toBe('/inventario');
    expect(activeHref('/productos/1/variantes/nueva', NAV_ITEMS)).toBe('/productos');
  });
  it('el inicio solo se marca en la raíz', () => {
    expect(activeHref('/', NAV_ITEMS)).toBe('/');
    expect(activeHref('/desconocida', NAV_ITEMS)).toBeNull();
  });
});
