/**
 * Cada código de error de negocio que lanzan las funciones SQL tiene su mensaje en español
 * en packages/domain (la app nunca muestra códigos técnicos).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUSINESS_ERROR_MESSAGES } from '@repo/domain';

const migrationsDir = join(import.meta.dirname, '..', 'migrations');

function codesInMigrations(): Set<string> {
  const codes = new Set<string>();
  const patterns = [
    /raise_error\(\s*'([A-Z_]+)'/g,
    /raise_forbidden\(\s*'([A-Z_]+)'/g,
    /message\s*=\s*'([A-Z_]+)'/g,
  ];
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    for (const re of patterns) for (const m of sql.matchAll(re)) codes.add(m[1]!);
  }
  return codes;
}

describe('códigos de error', () => {
  const codes = codesInMigrations();

  it('se encontraron códigos en las migraciones', () => {
    expect(codes.size).toBeGreaterThan(20);
  });

  it.each([...codesInMigrations()].sort())('%s tiene mensaje en español', (code) => {
    expect(BUSINESS_ERROR_MESSAGES).toHaveProperty(code);
  });
});
