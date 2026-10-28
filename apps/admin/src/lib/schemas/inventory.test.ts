import { describe, expect, it } from 'vitest';

import { adjustSchema, lotStatusSchema, readWarehouseForm, receiveSchema, warehouseSchema } from './inventory';

const WH = '0b6f4c2a-8d1e-4f3b-9a7c-5e2d1c0b9a8f';
const REQ = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f';

describe('receiveSchema', () => {
  it('valida bodega, cantidad entera positiva y fecha real', () => {
    const ok = receiveSchema.safeParse({ warehouseId: WH, quantity: '12', lotNumber: 'L-1', expiryDate: '2027-02-28', reason: '', requestId: REQ });
    expect(ok.success && ok.data).toMatchObject({ quantity: 12, expiryDate: '2027-02-28', reason: null });

    const bad = receiveSchema.safeParse({ warehouseId: '', quantity: '1.5', lotNumber: '', expiryDate: '2027-02-30', reason: '', requestId: 'x' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.map((i) => i.path.join('.')).sort()).toEqual(['expiryDate', 'quantity', 'requestId', 'warehouseId']);
    }
  });
  it('no acepta cero ni cantidades negativas', () => {
    expect(receiveSchema.safeParse({ warehouseId: WH, quantity: '0', lotNumber: '', expiryDate: '', reason: '', requestId: REQ }).success).toBe(false);
    expect(receiveSchema.safeParse({ warehouseId: WH, quantity: '-3', lotNumber: '', expiryDate: '', reason: '', requestId: REQ }).success).toBe(false);
  });
});

describe('adjustSchema', () => {
  it('exige motivo y sentido del ajuste', () => {
    const bad = adjustSchema.safeParse({ warehouseId: WH, direction: 'otro', quantity: '2', lotId: '', reason: ' ', requestId: REQ });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues.map((i) => i.path.join('.')).sort()).toEqual(['direction', 'reason']);
    const ok = adjustSchema.safeParse({ warehouseId: WH, direction: 'out', quantity: '2', lotId: '', reason: 'Producto dañado', requestId: REQ });
    expect(ok.success && ok.data.lotId).toBe(null);
  });
});

describe('lotStatusSchema', () => {
  it('solo estados conocidos y con motivo', () => {
    expect(lotStatusSchema.safeParse({ status: 'quarantine', reason: 'Reclamo de cliente' }).success).toBe(true);
    expect(lotStatusSchema.safeParse({ status: 'borrado', reason: 'x' }).success).toBe(false);
  });
});

describe('warehouseSchema', () => {
  it('normaliza el código a mayúsculas y valida la comuna', () => {
    const fd = new FormData();
    fd.set('code', 'stgo-central');
    fd.set('name', 'Bodega Santiago');
    fd.set('comunaCode', '13101');
    fd.set('isActive', 'on');
    const r = warehouseSchema.safeParse(readWarehouseForm(fd));
    expect(r.success && r.data).toMatchObject({ code: 'STGO-CENTRAL', comunaCode: '13101', isActive: true, isSellable: false, priority: 100 });
    fd.set('comunaCode', 'Santiago');
    expect(warehouseSchema.safeParse(readWarehouseForm(fd)).success).toBe(false);
  });
});
