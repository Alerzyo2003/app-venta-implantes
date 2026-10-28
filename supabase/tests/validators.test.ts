/** Paridad de validadores SQL ↔ TypeScript (RUT, GTIN, códigos). */
import { afterAll, describe, expect, it } from 'vitest';
import { isValidGtin, normalizeCode, normalizeRut } from '@repo/domain';
import { admin, pool } from './helpers/db';

afterAll(async () => {
  await pool.end();
});

describe('validadores', () => {
  const ruts = ['12.345.678-5', '12345678-5', '012.345.678-5', '30.686.957-4', '6-k', '14-0', '12.345.678-4', 'abc', '', '1.234.567.890-1'];
  it.each(ruts)('normalize_rut(%s) coincide con TypeScript', async (rut) => {
    const [row] = await admin<{ v: string | null }>(`select private.normalize_rut($1) as v`, [rut]);
    expect(row!.v).toBe(normalizeRut(rut));
  });

  const gtins = ['4006381333931', '04006381333931', '4006381333932', '12345670', '123', '96385074'];
  it.each(gtins)('is_valid_gtin(%s) coincide con TypeScript', async (g) => {
    const [row] = await admin<{ v: boolean }>(`select private.is_valid_gtin($1) as v`, [g]);
    expect(row!.v).toBe(isValidGtin(g));
  });

  const codes = ['IMP-40.10', ' imp 40/10 ', 'ÁBC-1', 'abc_123'];
  it.each(codes)('normalize_code(%s) coincide con TypeScript', async (c) => {
    const [row] = await admin<{ v: string }>(`select private.normalize_code($1) as v`, [c]);
    expect(row!.v).toBe(normalizeCode(c));
  });
});
