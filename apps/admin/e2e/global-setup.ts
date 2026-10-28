import { execFileSync } from 'node:child_process';
import path from 'node:path';

import pg from 'pg';

import { TEST_PASSWORD, USERS } from './fixtures';

/**
 * Reinicia la base local (migraciones + semilla) y crea cuentas de PRUEBA con contraseña.
 * Solo toca la base local de desarrollo (tools/local-db).
 */
export default async function globalSetup() {
  const root = path.resolve(import.meta.dirname, '../../..');
  execFileSync('bash', [path.join(root, 'tools/local-db/reset.sh')], { stdio: 'inherit' });

  const port = process.env.LOCAL_DB_PORT ?? '54329';
  const db = process.env.LOCAL_DB_NAME ?? 'implantes';
  const client = new pg.Client({ connectionString: `postgres://supabase_admin@127.0.0.1:${port}/${db}` });
  await client.connect();
  try {
    for (const user of Object.values(USERS)) {
      const { rows } = await client.query<{ id: string }>(
        `insert into auth.users (id, email, aud, role, email_confirmed_at, encrypted_password, raw_user_meta_data)
         values (gen_random_uuid(), $1, 'authenticated', 'authenticated', now(),
                 extensions.crypt($2, extensions.gen_salt('bf')), $3)
         returning id`,
        [user.email, TEST_PASSWORD, JSON.stringify({ full_name: user.name, account_type: 'general' })],
      );
      for (const role of user.roles) {
        await client.query(`insert into public.user_roles (user_id, role_code) values ($1, $2)`, [rows[0]!.id, role]);
      }
    }
  } finally {
    await client.end();
  }
}
