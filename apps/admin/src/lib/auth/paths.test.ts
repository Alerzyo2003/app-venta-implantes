import { describe, expect, it } from 'vitest';

import { isPublicPath, safeNextPath } from './paths';

describe('isPublicPath', () => {
  it('reconoce las rutas de acceso sin sesión', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/recuperar-clave')).toBe(true);
    expect(isPublicPath('/auth/confirm')).toBe(true);
  });
  it('el resto exige sesión', () => {
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/productos')).toBe(false);
    expect(isPublicPath('/loginx')).toBe(false);
    expect(isPublicPath('/mfa')).toBe(false);
  });
});

describe('safeNextPath (sin redirecciones abiertas)', () => {
  it('acepta rutas internas con su consulta', () => {
    expect(safeNextPath('/productos?estado=draft')).toBe('/productos?estado=draft');
    expect(safeNextPath('/inventario/123')).toBe('/inventario/123');
  });
  it.each([
    ['https://malicioso.example/x'],
    ['//malicioso.example'],
    ['/\\malicioso.example'],
    ['javascript:alert(1)'],
    ['productos'],
    [''],
    [null],
    [undefined],
    [42],
  ])('rechaza %s', (value) => {
    expect(safeNextPath(value)).toBe('/');
  });
  it('evita volver a las páginas de acceso', () => {
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath('/mfa?next=/x')).toBe('/');
    expect(safeNextPath('/recuperar-clave')).toBe('/');
  });
  it('normaliza rutas con «..» sin salir del panel', () => {
    expect(safeNextPath('/productos/../bodegas')).toBe('/bodegas');
  });
});
