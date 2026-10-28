import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl, isWithinBusinessHours, whatsappMessages } from './whatsapp';

describe('buildWhatsAppUrl', () => {
  it('construye el enlace con el mensaje codificado', () => {
    const url = buildWhatsAppUrl('+56 9 1234 5678', whatsappMessages.order('P26-000123'));
    expect(url).toBe(
      'https://wa.me/56912345678?text=Hola%2C%20quisiera%20consultar%20por%20mi%20pedido%20P26-000123.',
    );
  });
  it('rechaza números inválidos', () => {
    expect(() => buildWhatsAppUrl('123')).toThrow();
  });
  it('el mensaje de producto incluye solo nombre y SKU', () => {
    expect(whatsappMessages.product({ productName: 'Pilar recto', sku: 'PIL-01' })).toBe(
      'Hola, quisiera consultar por el producto Pilar recto (SKU PIL-01).',
    );
  });
});

describe('isWithinBusinessHours (America/Santiago)', () => {
  const hours = [{ days: [1, 2, 3, 4, 5], open: '09:00', close: '18:00' }];
  // 2026-10-28 es miércoles. Chile continental está en UTC-3 en esa fecha (horario de verano).
  it('dentro del horario', () => {
    expect(isWithinBusinessHours(hours, new Date('2026-10-28T13:00:00Z'))).toBe(true);
  });
  it('fuera del horario', () => {
    expect(isWithinBusinessHours(hours, new Date('2026-10-28T22:30:00Z'))).toBe(false);
  });
  it('fin de semana', () => {
    expect(isWithinBusinessHours(hours, new Date('2026-10-31T14:00:00Z'))).toBe(false);
  });
});
