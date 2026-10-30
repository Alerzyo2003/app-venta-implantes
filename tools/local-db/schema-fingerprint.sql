-- Huella del esquema: comprueba que un proyecto Supabase quedó exactamente como lo describen
-- las migraciones del repositorio. Se ejecuta la misma consulta en la base local
-- (pnpm db:reset) y en el proyecto (editor SQL) y se comparan los resultados.
--
-- Cubre los esquemas public y private: funciones (definición completa y privilegios), tablas
-- y vistas (columnas, RLS y privilegios), restricciones, índices, políticas, disparadores
-- (también los de auth.users que llaman a funciones propias), secuencias, privilegios de los
-- esquemas, la configuración de búsqueda y el contenido de las tablas (sin columnas uuid ni
-- fechas, que cambian entre entornos; audit_log se excluye).
--
-- Ignora dueños y otorgantes, que difieren entre entornos, y solo considera los privilegios de
-- los roles de la API (PUBLIC, anon, authenticated y service_role). El privilegio MAINTAIN se
-- omite porque solo existe desde PostgreSQL 17 (la base local de pruebas puede ser 16).
--
-- Resumen por tipo (una fila por tipo):  pnpm db:fingerprint
-- Detalle de un tipo: cambiar la consulta final por  select * from fp where kind = 'function'
select set_config('search_path', '', false);

with
api_role (oid, rolname) as (
  select 0::oid, 'public'
  union all
  select oid, rolname::text from pg_roles where rolname in ('anon', 'authenticated', 'service_role')
),
rel as (
  select c.oid, c.relkind, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity, c.reloptions,
         n.nspname, format('%I.%I', n.nspname, c.relname) as qname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private')
     and c.relkind in ('r', 'p', 'v', 'm', 'S')
     and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
),
fn as (
  select p.oid, p.proowner, p.proacl,
         format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as qname,
         concat_ws(E'\n', l.lanname, p.prokind, p.provolatile, p.prosecdef, p.proisstrict, p.proretset,
                   p.proparallel, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
                   array_to_string(p.proconfig, ','), p.prosrc) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
   where n.nspname in ('public', 'private')
     and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
),
fp (kind, name, hash) as (
  -- Funciones: lenguaje, volatilidad, security definer, argumentos, resultado, configuración y cuerpo.
  select 'function', f.qname, md5(f.def) from fn f
  union all
  select 'function_acl', f.qname, md5(coalesce((
           select string_agg(x.e, ',' order by x.e collate "C")
             from (select r.rolname || ':' || a.privilege_type as e
                     from aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
                     join api_role r on r.oid = a.grantee) x), ''))
    from fn f
  union all
  -- Tablas, vistas y secuencias: columnas, tipos, nulos, valores por omisión, generadas, RLS.
  select 'relation', r.qname, md5(concat_ws(E'\n', r.relkind, r.relrowsecurity, r.relforcerowsecurity,
           array_to_string(r.reloptions, ','),
           (select string_agg(concat_ws(' ', a.attname, format_type(a.atttypid, a.atttypmod),
                                        case when a.attnotnull then 'not null' end,
                                        case when a.attgenerated <> '' then 'generated ' || a.attgenerated::text end,
                                        case when a.attidentity <> '' then 'identity ' || a.attidentity::text end,
                                        pg_get_expr(ad.adbin, ad.adrelid)), E'\n' order by a.attnum)
              from pg_attribute a
              left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
             where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped),
           case when r.relkind in ('v', 'm') then pg_get_viewdef(r.oid) end,
           (select concat_ws(' ', format_type(s.seqtypid, null), s.seqstart, s.seqincrement, s.seqmax,
                             s.seqmin, s.seqcache, s.seqcycle)
              from pg_sequence s where s.seqrelid = r.oid)))
    from rel r
  union all
  select 'relation_acl', r.qname, md5(concat_ws(';',
           (select string_agg(x.e, ',' order by x.e collate "C")
              from (select ar.rolname || ':' || a.privilege_type as e
                      from aclexplode(coalesce(r.relacl, acldefault(
                             (case when r.relkind = 'S' then 's' else 'r' end)::"char", r.relowner))) a
                      join api_role ar on ar.oid = a.grantee
                     where a.privilege_type <> 'MAINTAIN') x),
           (select string_agg(x.e, ',' order by x.e collate "C")
              from (select att.attname || '/' || ar.rolname || ':' || a.privilege_type as e
                      from pg_attribute att
                      cross join lateral aclexplode(att.attacl) a
                      join api_role ar on ar.oid = a.grantee
                     where att.attrelid = r.oid and att.attnum > 0 and not att.attisdropped) x)))
    from rel r
  union all
  select 'constraint', format('%s.%I', r.qname, c.conname), md5(pg_get_constraintdef(c.oid))
    from pg_constraint c join rel r on r.oid = c.conrelid
  union all
  select 'index', format('%s.%I', r.qname, ic.relname), md5(pg_get_indexdef(i.indexrelid))
    from pg_index i
    join rel r on r.oid = i.indrelid
    join pg_class ic on ic.oid = i.indexrelid
  union all
  select 'policy', format('%s.%I', r.qname, p.polname), md5(concat_ws(E'\n', p.polcmd, p.polpermissive,
           (select string_agg(x.n, ',' order by x.n collate "C")
              from (select case when ro = 0 then 'public' else (select rolname::text from pg_roles where oid = ro) end as n
                      from unnest(p.polroles) ro) x),
           pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)))
    from pg_policy p join rel r on r.oid = p.polrelid
  union all
  select 'trigger', format('%I.%I.%I', n.nspname, c.relname, t.tgname), md5(pg_get_triggerdef(t.oid))
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
   where not t.tgisinternal
     and (n.nspname in ('public', 'private') or pn.nspname in ('public', 'private'))
  union all
  select 'schema_acl', format('%I', n.nspname), md5(coalesce((
           select string_agg(x.e, ',' order by x.e collate "C")
             from (select ar.rolname || ':' || a.privilege_type as e
                     from aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
                     join api_role ar on ar.oid = a.grantee) x), ''))
    from pg_namespace n where n.nspname in ('public', 'private')
  union all
  select 'ts_config', format('%I.%I', n.nspname, c.cfgname), md5(coalesce((
           select string_agg(x.e, ',' order by x.e collate "C")
             from (select m.maptokentype || ':' || m.mapseqno || ':' || d.dictname as e
                     from pg_ts_config_map m join pg_ts_dict d on d.oid = m.mapdict
                    where m.mapcfg = c.oid) x), ''))
    from pg_ts_config c join pg_namespace n on n.oid = c.cfgnamespace
   where n.nspname in ('public', 'private')
  union all
  -- Contenido: cantidad de filas y huella de las columnas estables (sin uuid ni fechas).
  select 'data', r.qname, (xpath('/row/h/text()', query_to_xml(format(
           'select count(*) || '' '' || md5(coalesce(string_agg(t::text, ''|'' order by t::text collate "C"), '''')) as h'
           || ' from (select %s from %s) t', c.cols, r.qname), false, true, '')))[1]::text
    from rel r
    cross join lateral (
      select coalesce(string_agg(format('%I', a.attname), ', ' order by a.attnum), 'null') as cols
        from pg_attribute a
       where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
         and a.atttypid not in ('uuid'::regtype, 'timestamptz'::regtype, 'timestamp'::regtype)
    ) c
   where r.relkind in ('r', 'p') and r.nspname = 'public' and r.qname <> 'public.audit_log'
  union all
  -- Árbol de categorías (parent_id es uuid y no entra en la huella anterior).
  select 'data', 'public.categories:tree', (xpath('/row/h/text()', query_to_xml(
           'select md5(coalesce(string_agg(c.slug || ''<'' || coalesce(p.slug, ''''), '','' order by c.slug collate "C"), '''')) as h'
           || ' from public.categories c left join public.categories p on p.id = c.parent_id', false, true, '')))[1]::text
   where to_regclass('public.categories') is not null
)
select kind, count(*) as objects, md5(string_agg(name || '=' || hash, ',' order by name collate "C")) as hash
  from fp
 group by kind
 order by kind collate "C";
