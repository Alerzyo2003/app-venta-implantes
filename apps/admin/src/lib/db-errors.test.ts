import { describe, expect, it } from 'vitest';

import { dbErrorMessage } from './db-errors';

describe('dbErrorMessage', () => {
  it('explica restricciones conocidas', () => {
    expect(
      dbErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "product_variants_sku_idx"' }),
    ).toBe('Ya existe una variante con ese SKU.');
    expect(
      dbErrorMessage({ code: '23514', message: 'new row for relation "products" violates check constraint "products_check"' }),
    ).toBe('Para controlar vencimientos, el producto también debe controlar lotes.');
  });
  it('usa mensajes genéricos para restricciones no mapeadas', () => {
    expect(dbErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "otra"' })).toBe(
      'Ya existe un registro con esos datos.',
    );
    expect(dbErrorMessage({ code: '22P02', message: 'invalid input syntax for type uuid' })).toMatch(/formato no válido/);
  });
  it('traduce errores de negocio y de permisos', () => {
    expect(dbErrorMessage({ code: 'P0001', message: 'NO_ACTIVE_VARIANT' })).toBe(
      'Para publicar el producto, agrega al menos una variante activa.',
    );
    expect(dbErrorMessage({ code: '42501', message: 'MFA_REQUIRED' })).toBe('Esta acción requiere verificación en dos pasos.');
    expect(dbErrorMessage({ code: '42501', message: 'permission denied for table products' })).toBe(
      'No tienes permiso para realizar esta acción.',
    );
  });
  it('nunca expone detalles técnicos desconocidos', () => {
    expect(dbErrorMessage({ code: 'XX000', message: 'internal: stack trace' })).toBe(
      'Ocurrió un error inesperado. Intenta nuevamente.',
    );
  });
});
