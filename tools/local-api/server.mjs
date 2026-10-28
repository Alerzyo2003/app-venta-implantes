/**
 * Emulador mínimo de Supabase (Auth + REST) sobre la base PostgreSQL local, SOLO para pruebas
 * automatizadas de interfaz en entornos sin Docker. NO es Supabase ni lo reemplaza:
 *
 * - REST: traduce el subconjunto de la sintaxis de PostgREST que usan las apps (select con
 *   relaciones de un nivel, filtros eq/neq/gt/gte/lt/lte/like/ilike/is/in, order, limit/offset,
 *   insert/upsert/update y RPC) a SQL ejecutado con el rol y los claims del JWT, igual que
 *   PostgREST (SET LOCAL ROLE + request.jwt.claims). RLS, triggers y funciones son los reales.
 * - Auth: inicio de sesión con contraseña (verificada con pgcrypto contra auth.users),
 *   renovación de sesión, usuario actual, cierre de sesión y MFA TOTP con un código fijo de
 *   prueba. No envía correos.
 *
 * Los JWT se firman con una clave local fija: solo sirve en 127.0.0.1.
 */
import crypto from 'node:crypto';
import http from 'node:http';

import pg from 'pg';

const PORT = Number(process.env.LOCAL_API_PORT ?? 54331);
const HOST = '127.0.0.1';
const DATABASE_URL =
  process.env.LOCAL_API_DATABASE_URL ??
  `postgres://supabase_admin@127.0.0.1:${process.env.LOCAL_DB_PORT ?? '54329'}/${process.env.LOCAL_DB_NAME ?? 'implantes'}`;
const JWT_SECRET = 'emulador-local-solo-para-pruebas';
/** Código TOTP aceptado por el emulador (documentado en README). */
export const TEST_TOTP_CODE = '123456';
const SESSION_SECONDS = 3600;

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });
// Si la base se reinicia (tools/local-db/reset.sh), las conexiones inactivas se cierran: se
// descartan sin detener el emulador y el pool abre conexiones nuevas en la siguiente solicitud.
pool.on('error', (err) => console.warn('[local-api] conexión descartada:', err.message));

// ---------------------------------------------------------------------------
// JWT HS256
// ---------------------------------------------------------------------------
const b64url = (value) => Buffer.from(value).toString('base64url');

function signJwt(payload) {
  const data = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
  return `${data}.${crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')}`;
}

function verifyJwt(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function bearer(req) {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------
function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

class HttpError extends Error {
  constructor(status, body) {
    super(body.message ?? body.msg ?? 'error');
    this.status = status;
    this.body = body;
  }
}

const authError = (status, code, msg) => new HttpError(status, { code: status, error_code: code, msg });
const restError = (status, code, message, details = null) => new HttpError(status, { code, message, details, hint: null });

function pgErrorToHttp(err, authenticated) {
  const status =
    err.code === '42501' ? (authenticated ? 403 : 401)
    : err.code === '23505' || err.code === '23503' ? 409
    : err.code === '42883' || err.code === '42P01' ? 404
    : 400;
  return new HttpError(status, { code: err.code ?? 'XX000', message: err.message, details: err.detail ?? null, hint: err.hint ?? null });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw restError(400, 'PGRST102', 'Cuerpo JSON no válido');
  }
}

// ---------------------------------------------------------------------------
// Auth (GoTrue mínimo)
// ---------------------------------------------------------------------------
/** Factores MFA por usuario (en memoria: se reinician con el emulador). */
const factorsByUser = new Map();
const refreshTokens = new Map();
const challenges = new Map();

async function loadUser(id) {
  const { rows } = await pool.query(
    `select id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, last_sign_in_at
       from auth.users where id = $1 and deleted_at is null`,
    [id],
  );
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    confirmed_at: u.email_confirmed_at,
    phone: '',
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: { provider: 'email', providers: ['email'], ...(u.raw_app_meta_data ?? {}) },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at ?? u.created_at,
    is_anonymous: false,
    factors: factorsByUser.get(u.id) ?? [],
  };
}

async function issueSession(userId, aal, sessionId = crypto.randomUUID()) {
  const user = await loadUser(userId);
  if (!user) throw authError(404, 'user_not_found', 'User not found');
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    sub: userId,
    email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
    aal,
    amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: now }],
    session_id: sessionId,
    is_anonymous: false,
    iss: `http://${HOST}:${PORT}/auth/v1`,
    iat: now,
    exp: now + SESSION_SECONDS,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
  });
  const refreshToken = crypto.randomBytes(24).toString('base64url');
  refreshTokens.set(refreshToken, { userId, aal, sessionId });
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: SESSION_SECONDS,
    expires_at: now + SESSION_SECONDS,
    refresh_token: refreshToken,
    user,
  };
}

function requireUserToken(req) {
  const claims = verifyJwt(bearer(req));
  if (!claims) throw authError(401, 'bad_jwt', 'invalid JWT');
  return claims;
}

const QR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="#fff"/>' +
  '<path d="M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1z" fill="#000"/><text x="10" y="17" font-size="3">PRUEBA</text></svg>';

async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1/, '');
  const method = req.method;

  if (method === 'POST' && path === '/token') {
    const body = (await readBody(req)) ?? {};
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const { rows } = await pool.query(
        `select id, email_confirmed_at,
                encrypted_password is not null and encrypted_password = extensions.crypt($2, encrypted_password) as ok
           from auth.users where lower(email) = lower($1) and deleted_at is null`,
        [String(body.email ?? ''), String(body.password ?? '')],
      );
      const u = rows[0];
      if (!u || !u.ok) throw authError(400, 'invalid_credentials', 'Invalid login credentials');
      if (!u.email_confirmed_at) throw authError(400, 'email_not_confirmed', 'Email not confirmed');
      await pool.query(`update auth.users set last_sign_in_at = now() where id = $1`, [u.id]);
      return send(res, 200, await issueSession(u.id, 'aal1'));
    }
    if (grant === 'refresh_token') {
      const current = refreshTokens.get(String(body.refresh_token ?? ''));
      if (!current) throw authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      refreshTokens.delete(String(body.refresh_token));
      return send(res, 200, await issueSession(current.userId, current.aal, current.sessionId));
    }
    throw authError(400, 'validation_failed', 'unsupported grant_type');
  }

  if (method === 'GET' && path === '/user') {
    const claims = requireUserToken(req);
    const user = await loadUser(claims.sub);
    if (!user) throw authError(403, 'user_not_found', 'User from sub claim in JWT does not exist');
    return send(res, 200, user);
  }

  if (method === 'PUT' && path === '/user') {
    const claims = requireUserToken(req);
    const body = (await readBody(req)) ?? {};
    if (typeof body.password === 'string') {
      if (body.password.length < 6) throw authError(422, 'weak_password', 'Password should be at least 6 characters.');
      await pool.query(
        `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1`,
        [claims.sub, body.password],
      );
    }
    return send(res, 200, await loadUser(claims.sub));
  }

  if (method === 'POST' && path === '/logout') {
    return send(res, 204);
  }

  if (method === 'POST' && path === '/recover') {
    // El emulador no envía correos; responde como Supabase (sin revelar si la cuenta existe).
    return send(res, 200, {});
  }

  if (method === 'POST' && path === '/factors') {
    const claims = requireUserToken(req);
    const body = (await readBody(req)) ?? {};
    if (body.factor_type !== 'totp') throw authError(422, 'validation_failed', 'only totp');
    const list = factorsByUser.get(claims.sub) ?? [];
    const now = new Date().toISOString();
    const factor = { id: crypto.randomUUID(), friendly_name: body.friendly_name, factor_type: 'totp', status: 'unverified', created_at: now, updated_at: now };
    factorsByUser.set(claims.sub, [...list, factor]);
    return send(res, 200, {
      id: factor.id,
      type: 'totp',
      friendly_name: factor.friendly_name,
      totp: { qr_code: QR_SVG, secret: 'PRUEBALOCALSOLOTEST', uri: 'otpauth://totp/prueba?secret=PRUEBALOCALSOLOTEST' },
    });
  }

  const factorMatch = /^\/factors\/([^/]+)(\/challenge|\/verify)?$/.exec(path);
  if (factorMatch) {
    const claims = requireUserToken(req);
    const [, factorId, action] = factorMatch;
    const list = factorsByUser.get(claims.sub) ?? [];
    const factor = list.find((f) => f.id === factorId);
    if (!factor) throw authError(404, 'mfa_factor_not_found', 'Factor not found');
    if (method === 'DELETE' && !action) {
      factorsByUser.set(claims.sub, list.filter((f) => f.id !== factorId));
      return send(res, 200, { id: factorId });
    }
    if (method === 'POST' && action === '/challenge') {
      const challenge = { id: crypto.randomUUID(), factorId, expires_at: Math.floor(Date.now() / 1000) + 300 };
      challenges.set(challenge.id, challenge);
      return send(res, 200, { id: challenge.id, type: 'totp', expires_at: challenge.expires_at });
    }
    if (method === 'POST' && action === '/verify') {
      const body = (await readBody(req)) ?? {};
      const challenge = challenges.get(String(body.challenge_id ?? ''));
      if (!challenge || challenge.factorId !== factorId) throw authError(422, 'mfa_challenge_expired', 'Challenge expired');
      challenges.delete(challenge.id);
      if (body.code !== TEST_TOTP_CODE) throw authError(422, 'mfa_verification_failed', 'Invalid TOTP code entered');
      factor.status = 'verified';
      factor.updated_at = new Date().toISOString();
      return send(res, 200, await issueSession(claims.sub, 'aal2', claims.session_id));
    }
  }

  throw authError(404, 'not_found', `Ruta de Auth no emulada: ${method} ${path}`);
}

// ---------------------------------------------------------------------------
// REST (subconjunto de PostgREST)
// ---------------------------------------------------------------------------
const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw restError(400, 'PGRST100', `Identificador no válido: ${name}`);
  return `"${name}"`;
};

let foreignKeys = null;
async function loadForeignKeys() {
  const { rows } = await pool.query(`
    select con.conname as name, src.relname as src, tgt.relname as tgt,
           array(select a.attname::text from unnest(con.conkey) with ordinality k(n, o)
                   join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.o) as src_cols,
           array(select a.attname::text from unnest(con.confkey) with ordinality k(n, o)
                   join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.o) as tgt_cols
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_class tgt on tgt.oid = con.confrelid
      join pg_namespace ns on ns.oid = src.relnamespace
     where con.contype = 'f' and ns.nspname = 'public'`);
  foreignKeys = rows;
}

async function ensureForeignKeys() {
  if (!foreignKeys) await loadForeignKeys();
}

function findRelation(base, target, hint) {
  const toOne = foreignKeys.filter((f) => f.src === base && f.tgt === target && (!hint || f.name === hint));
  const toMany = foreignKeys.filter((f) => f.src === target && f.tgt === base && (!hint || f.name === hint));
  const all = [...toOne.map((f) => ({ kind: 'one', f })), ...toMany.map((f) => ({ kind: 'many', f }))];
  if (all.length === 0) throw restError(400, 'PGRST200', `Sin relación entre ${base} y ${target}`);
  if (all.length > 1) throw restError(300, 'PGRST201', `Relación ambigua entre ${base} y ${target}`);
  return all[0];
}

function splitTopLevel(input) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseSelect(input) {
  return splitTopLevel(input || '*').map((item) => {
    if (item === '*') return { kind: 'star' };
    const m = /^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)(?:!([a-z_][a-z0-9_]*))?(?:\((.*)\))?$/s.exec(item);
    if (!m) throw restError(400, 'PGRST100', `select no soportado por el emulador: ${item}`);
    const [, alias, name, hint, children] = m;
    if (children !== undefined) return { kind: 'embed', alias: alias ?? name, table: name, hint, children: parseSelect(children) };
    return { kind: 'column', name, alias: alias ?? name };
  });
}

function buildSelect(table, items, alias, depth = 0) {
  return items
    .map((it, i) => {
      if (it.kind === 'star') return `${alias}.*`;
      if (it.kind === 'column') return `${alias}.${ident(it.name)} as ${ident(it.alias)}`;
      const rel = findRelation(table, it.table, it.hint);
      const sub = `e${depth}_${i}`;
      const inner = buildSelect(it.table, it.children, sub, depth + 1);
      if (rel.kind === 'one') {
        const on = rel.f.src_cols.map((c, k) => `${sub}.${ident(rel.f.tgt_cols[k])} = ${alias}.${ident(c)}`).join(' and ');
        return `(select row_to_json(x) from (select ${inner} from public.${ident(it.table)} ${sub} where ${on}) x) as ${ident(it.alias)}`;
      }
      const on = rel.f.src_cols.map((c, k) => `${sub}.${ident(c)} = ${alias}.${ident(rel.f.tgt_cols[k])}`).join(' and ');
      return `coalesce((select json_agg(row_to_json(x)) from (select ${inner} from public.${ident(it.table)} ${sub} where ${on}) x), '[]'::json) as ${ident(it.alias)}`;
    })
    .join(', ');
}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function parseInList(raw) {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  return splitTopLevel(inner).map((v) => v.replace(/^"(.*)"$/s, '$1'));
}

function buildWhere(url, alias, params) {
  const clauses = [];
  for (const [key, raw] of url.searchParams) {
    if (RESERVED_PARAMS.has(key)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s.exec(raw);
    if (!m) throw restError(400, 'PGRST100', `Filtro no soportado por el emulador: ${key}=${raw}`);
    const [, not, op, value] = m;
    const col = `${alias}.${ident(key)}`;
    let clause;
    if (op === 'is') {
      if (!['null', 'true', 'false'].includes(value)) throw restError(400, 'PGRST100', `is.${value}`);
      clause = `${col} is ${value}`;
    } else if (op === 'in') {
      params.push(parseInList(value));
      clause = `${col} = any($${params.length})`;
    } else {
      params.push(op === 'like' || op === 'ilike' ? value.replaceAll('*', '%') : value);
      const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op];
      clause = `${col} ${sqlOp} $${params.length}`;
    }
    clauses.push(not ? `not (${clause})` : clause);
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : '';
}

function buildOrder(url, alias) {
  const order = url.searchParams.get('order');
  if (!order) return '';
  const parts = order.split(',').map((term) => {
    const [col, ...mods] = term.split('.');
    const dir = mods.includes('desc') ? 'desc' : 'asc';
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : '';
    return `${alias}.${ident(col)} ${dir}${nulls}`;
  });
  return `order by ${parts.join(', ')}`;
}

function buildLimit(url) {
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  return `${limit ? `limit ${Number.parseInt(limit, 10)}` : ''} ${offset ? `offset ${Number.parseInt(offset, 10)}` : ''}`;
}

const sqlValue = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);

async function withRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims ?? { role: 'anon' })]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function handleRpc(client, name, args) {
  const { rows } = await client.query(
    `select p.proretset as retset, format_type(p.prorettype, null) as rettype,
            coalesce(p.proargnames, '{}') as names,
            array(select format_type(t, null) from unnest(p.proargtypes) t) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`,
    [name],
  );
  const keys = Object.keys(args ?? {});
  const fn = rows.find((r) => keys.every((k) => r.names.includes(k)));
  if (!fn) throw restError(404, 'PGRST202', `No se encontró la función public.${name} con esos parámetros`);
  const params = [];
  const callArgs = keys.map((k) => {
    params.push(sqlValue(args[k]));
    const type = fn.types[fn.names.indexOf(k)];
    return `${ident(k)} => $${params.length}::${type}`;
  });
  const call = `public.${ident(name)}(${callArgs.join(', ')})`;
  if (fn.retset) {
    const r = await client.query(`select coalesce(json_agg(row_to_json(q)), '[]'::json) as data from ${call} q`, params);
    return { status: 200, data: r.rows[0].data };
  }
  if (fn.rettype === 'void') {
    await client.query(`select ${call}`, params);
    return { status: 204 };
  }
  const r = await client.query(`select to_json(${call}) as data`, params);
  return { status: 200, data: r.rows[0].data };
}

async function handleRest(req, res, url) {
  // Sin sesión, el cliente envía la clave publicable como bearer (no es un JWT del emulador): anon.
  const token = bearer(req);
  let claims = null;
  if (token && token.split('.').length === 3) {
    claims = verifyJwt(token);
    if (!claims) throw restError(401, 'PGRST301', 'JWT expired');
  }
  const path = url.pathname.replace(/^\/rest\/v1/, '');
  const wantsObject = String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');
  const prefer = String(req.headers.prefer ?? '');
  const body = req.method === 'GET' || req.method === 'HEAD' ? null : await readBody(req);

  try {
    const result = await withRole(claims, async (client) => {
      const rpc = /^\/rpc\/([a-z_][a-z0-9_]*)$/.exec(path);
      if (rpc) return handleRpc(client, rpc[1], body);

      await ensureForeignKeys();
      const table = /^\/([a-z_][a-z0-9_]*)$/.exec(path)?.[1];
      if (!table) throw restError(404, 'PGRST125', `Ruta no válida: ${path}`);
      const select = parseSelect(url.searchParams.get('select') ?? '*');
      const params = [];

      if (req.method === 'GET') {
        const where = buildWhere(url, 'b', params);
        const sql = `select coalesce(json_agg(row_to_json(q)), '[]'::json) as data from (
          select ${buildSelect(table, select, 'b')} from public.${ident(table)} b ${where} ${buildOrder(url, 'b')} ${buildLimit(url)}) q`;
        return { status: 200, data: (await client.query(sql, params)).rows[0].data };
      }

      const returning = prefer.includes('return=representation');
      const finish = async (cte) => {
        const sql = `with r as (${cte}) select coalesce(json_agg(row_to_json(q)), '[]'::json) as data from (
          select ${buildSelect(table, select, 'b')} from r b) q`;
        const data = (await client.query(sql, params)).rows[0].data;
        return { status: req.method === 'POST' ? 201 : 200, data: returning ? data : undefined };
      };

      if (req.method === 'POST') {
        const rows = Array.isArray(body) ? body : [body];
        const cols = [...new Set(rows.flatMap((r) => Object.keys(r ?? {})))];
        const values = rows
          .map((r) => `(${cols.map((c) => (c in r ? (params.push(sqlValue(r[c])), `$${params.length}`) : 'default')).join(', ')})`)
          .join(', ');
        let conflict = '';
        const onConflict = url.searchParams.get('on_conflict');
        if (prefer.includes('resolution=merge-duplicates') && onConflict) {
          const keys = onConflict.split(',');
          const updates = cols.filter((c) => !keys.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`);
          conflict = `on conflict (${keys.map(ident).join(', ')}) do ${updates.length ? `update set ${updates.join(', ')}` : 'nothing'}`;
        } else if (prefer.includes('resolution=ignore-duplicates')) {
          conflict = 'on conflict do nothing';
        }
        return finish(`insert into public.${ident(table)} as b (${cols.map(ident).join(', ')}) values ${values} ${conflict} returning b.*`);
      }

      if (req.method === 'PATCH') {
        const sets = Object.keys(body ?? {}).map((c) => {
          params.push(sqlValue(body[c]));
          return `${ident(c)} = $${params.length}`;
        });
        const where = buildWhere(url, 'b', params);
        return finish(`update public.${ident(table)} b set ${sets.join(', ')} ${where} returning b.*`);
      }

      if (req.method === 'DELETE') {
        const where = buildWhere(url, 'b', params);
        return finish(`delete from public.${ident(table)} b ${where} returning b.*`);
      }
      throw restError(405, 'PGRST117', `Método no soportado: ${req.method}`);
    });

    if (result.status === 204 || result.data === undefined) return send(res, result.status === 201 ? 201 : 204);
    if (wantsObject) {
      const rows = Array.isArray(result.data) ? result.data : [result.data];
      if (rows.length !== 1) {
        throw restError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${rows.length} rows`);
      }
      return send(res, result.status, rows[0]);
    }
    return send(res, result.status, result.data);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err && typeof err.code === 'string') throw pgErrorToHttp(err, Boolean(claims));
    throw err;
  }
}

// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  try {
    if (url.pathname === '/__health') return send(res, 200, { ok: true });
    if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url);
    if (url.pathname.startsWith('/rest/v1/')) return await handleRest(req, res, url);
    throw restError(404, 'NOT_FOUND', `Ruta no emulada: ${url.pathname}`);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, err.body);
    console.error('[local-api] error interno', err);
    return send(res, 500, { code: 'XX000', message: 'Error interno del emulador' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[local-api] Emulador de Supabase (solo pruebas) en http://${HOST}:${PORT} → ${DATABASE_URL.replace(/\/\/[^@]*@/, '//***@')}`);
});
