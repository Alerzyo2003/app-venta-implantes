import { describe, expect, it } from 'vitest';

import { can, canAny, classifyAccess, type Access } from './access';

const staff: Access = { is_staff: true, aal: 'aal2', mfa_required: true, roles: ['inventario'], permissions: ['inventory.read'] };

describe('classifyAccess', () => {
  it('sin datos = sin sesión', () => {
    expect(classifyAccess(null)).toBe('anonymous');
  });
  it('clientes no acceden al panel', () => {
    expect(classifyAccess({ ...staff, is_staff: false, roles: [], permissions: [] })).toBe('not_staff');
  });
  it('el personal sin MFA debe completar la verificación', () => {
    expect(classifyAccess({ ...staff, aal: 'aal1' })).toBe('mfa_pending');
  });
  it('si la configuración no exige MFA, basta con aal1', () => {
    expect(classifyAccess({ ...staff, aal: 'aal1', mfa_required: false })).toBe('staff');
  });
  it('personal con MFA verificado', () => {
    expect(classifyAccess(staff)).toBe('staff');
  });
});

describe('can / canAny', () => {
  const holder = { permissions: new Set(['catalog.read', 'inventory.read']) };
  it('verifica permisos puntuales', () => {
    expect(can(holder, 'catalog.read')).toBe(true);
    expect(can(holder, 'catalog.update')).toBe(false);
  });
  it('basta con uno; la lista vacía no exige permisos', () => {
    expect(canAny(holder, ['catalog.update', 'inventory.read'])).toBe(true);
    expect(canAny(holder, ['catalog.update'])).toBe(false);
    expect(canAny(holder, [])).toBe(true);
  });
});
