/**
 * Privilegios de la API (migración 1000): sin sesión solo se ejecutan las funciones
 * SECURITY DEFINER del catálogo público, y las de pagos y tareas programadas quedan reservadas
 * al servidor. Una función nueva expuesta por error hace fallar esta prueba.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { admin, pool } from './helpers/db';

/** Usadas por el catálogo público: solo devuelven lo que la configuración permite ver. */
const ANON_ALLOWED = ['get_availability', 'get_variant_prices'];
/** Solo el servidor (service_role): pagos y tareas programadas. */
const SERVICE_ONLY = ['apply_payment_result', 'create_payment_attempt', 'release_expired_reservations'];

afterAll(async () => {
  await pool.end();
});

async function securityDefinerExecutableBy(role: string): Promise<string[]> {
  const rows = await admin<{ name: string }>(
    `select p.proname as name
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and has_function_privilege($1, p.oid, 'execute')
      order by 1`,
    [role],
  );
  return rows.map((r) => r.name);
}

describe('privilegios de la API', () => {
  it('sin sesión solo se ejecutan las funciones del catálogo público', async () => {
    expect(await securityDefinerExecutableBy('anon')).toEqual(ANON_ALLOWED);
  });

  it('con sesión de usuario no se ejecutan las funciones de pagos ni las tareas programadas', async () => {
    const executable = await securityDefinerExecutableBy('authenticated');
    for (const name of SERVICE_ONLY) expect(executable).not.toContain(name);
  });

  it('el servidor (service_role) ejecuta las funciones de pagos y las tareas programadas', async () => {
    const executable = await securityDefinerExecutableBy('service_role');
    for (const name of SERVICE_ONLY) expect(executable).toContain(name);
  });
});
