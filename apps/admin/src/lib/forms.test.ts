import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fieldErrorsFrom, formBool, formText, formValues, invalid } from './forms';

describe('formularios', () => {
  it('toma el primer error de cada campo', () => {
    const schema = z.object({ name: z.string().min(2, 'corto').max(1, 'largo'), sku: z.string().min(1, 'requerido') });
    const result = schema.safeParse({ name: 'x', sku: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFrom(result.error)).toEqual({ name: 'corto', sku: 'requerido' });
      expect(invalid(result.error, { name: 'x' })).toMatchObject({ status: 'error', values: { name: 'x' } });
    }
  });

  it('lee textos y casillas de FormData', () => {
    const fd = new FormData();
    fd.set('name', '  Implante  ');
    fd.set('tracksLots', 'on');
    expect(formText(fd, 'name')).toBe('Implante');
    expect(formText(fd, 'missing')).toBe('');
    expect(formBool(fd, 'tracksLots')).toBe(true);
    expect(formBool(fd, 'tracksExpiry')).toBe(false);
  });

  it('nunca devuelve contraseñas, códigos ni campos internos', () => {
    const fd = new FormData();
    fd.set('email', 'a@b.cl');
    fd.set('password', 'secreta');
    fd.set('passwordConfirm', 'secreta');
    fd.set('code', '123456');
    fd.set('$ACTION_ID_abc', '');
    expect(formValues(fd)).toEqual({ email: 'a@b.cl' });
  });
});
