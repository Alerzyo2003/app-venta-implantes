-- =============================================================================
-- 0600 · Buscador inteligente (BUS-01..06)
--   Texto completo en español sin tildes + trigramas (tolerancia a errores) +
--   códigos normalizados + filtros técnicos combinables. Respeta RLS (security invoker).
--   La interpretación de medidas en texto libre ("4.0 x 10 mm") la hace
--   packages/domain/src/search.ts y llega aquí como filtros.
-- =============================================================================

grant execute on function
  private.unit_price_for(uuid, int),
  private.available_qty(uuid),
  private.sellable_on_hand(uuid, uuid),
  private.lot_is_sellable(text, date),
  private.iva_rate()
to anon, authenticated, service_role;

create function public.search_catalog(
  p_query text default null,
  p_code text default null,
  p_category_id uuid default null,
  p_brand_ids uuid[] default null,
  p_manufacturer_ids uuid[] default null,
  p_system_ids uuid[] default null,
  p_platform_ids uuid[] default null,
  p_connection_type_ids uuid[] default null,
  p_product_kinds text[] default null,
  p_diameter_mm numeric default null,
  p_length_mm numeric default null,
  p_diameter_min numeric default null,
  p_diameter_max numeric default null,
  p_length_min numeric default null,
  p_length_max numeric default null,
  p_in_stock_only boolean default false,
  p_featured_only boolean default false,
  p_sort text default 'relevance',
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  product_id uuid,
  slug text,
  name text,
  product_kind text,
  brand_name text,
  manufacturer_name text,
  system_name text,
  category_id uuid,
  requires_professional boolean,
  image_path text,
  variant_count int,
  matched_variant_ids uuid[],
  price_visible boolean,
  min_price_net bigint,
  min_price_gross bigint,
  availability text,
  rank real,
  total_count bigint
)
language plpgsql stable
set search_path = ''
as $$
declare
  v_q text := nullif(trim(p_query), '');
  v_q_norm text := lower(private.f_unaccent(coalesce(nullif(trim(p_query), ''), '')));
  v_tsq tsquery;
  v_code text := nullif(private.normalize_code(coalesce(p_code, '')), '');
  v_variant_filters boolean := p_diameter_mm is not null or p_length_mm is not null
    or p_diameter_min is not null or p_diameter_max is not null
    or p_length_min is not null or p_length_max is not null
    or p_platform_ids is not null or p_connection_type_ids is not null;
  v_price_visible boolean := private.can_view_prices();
  v_rate numeric := private.iva_rate();
  v_threshold int := private.setting_int('inventory.low_stock_threshold', 5);
  v_limit int := least(greatest(coalesce(p_limit, 24), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if v_q is not null then
    v_tsq := websearch_to_tsquery('public.es_unaccent'::regconfig, v_q);
  end if;
  if p_sort not in ('relevance', 'price_asc', 'price_desc', 'name', 'newest') then
    p_sort := 'relevance';
  end if;

  return query
  with variants as (
    select pv.id, pv.product_id,
           (v_code is not null and (pv.sku_norm = v_code or pv.manufacturer_ref_norm = v_code
                                    or pv.gtin = lpad(v_code, 14, '0'))) as exact_code,
           (v_code is not null and length(v_code) >= 3
              and (pv.sku_norm like v_code || '%' or pv.manufacturer_ref_norm like v_code || '%')) as prefix_code,
           (    (p_diameter_mm is null or abs(pv.diameter_mm - p_diameter_mm) < 0.001)
            and (p_length_mm is null or abs(pv.length_mm - p_length_mm) < 0.001)
            and (p_diameter_min is null or pv.diameter_mm >= p_diameter_min)
            and (p_diameter_max is null or pv.diameter_mm <= p_diameter_max)
            and (p_length_min is null or pv.length_mm >= p_length_min)
            and (p_length_max is null or pv.length_mm <= p_length_max)
            and (p_platform_ids is null or pv.platform_id = any (p_platform_ids))
            and (p_connection_type_ids is null or pv.connection_type_id = any (p_connection_type_ids))
           ) as passes_filters
      from public.product_variants pv
     where pv.status <> 'inactive'
  ),
  candidates as (
    select p.id,
           count(v.id)::int as variant_count,
           coalesce(array_agg(v.id order by v.id) filter (
             where (v_variant_filters and v.passes_filters)
                or (not v_variant_filters and (v.exact_code or v.prefix_code))), '{}') as matched,
           coalesce(bool_or(v.exact_code and v.passes_filters), false) as exact_code,
           coalesce(bool_or(v.prefix_code and v.passes_filters), false) as prefix_code,
           coalesce(bool_or(v.passes_filters), false) as any_passes
      from public.products p
      left join variants v on v.product_id = p.id
     where (p_category_id is null or p.category_id in (select private.category_descendants(p_category_id)))
       and (p_brand_ids is null or p.brand_id = any (p_brand_ids))
       and (p_manufacturer_ids is null or p.manufacturer_id = any (p_manufacturer_ids))
       and (p_system_ids is null or p.implant_system_id = any (p_system_ids))
       and (p_product_kinds is null or p.product_kind = any (p_product_kinds))
       and (not coalesce(p_featured_only, false) or p.is_featured)
     group by p.id
  ),
  matched as (
    select c.*, p.slug, p.name, p.product_kind, p.category_id, p.requires_professional, p.created_at,
           p.brand_id, p.manufacturer_id, p.implant_system_id,
           (case when c.exact_code then 10 else 0 end
            + case when c.prefix_code then 3 else 0 end
            + case when v_tsq is not null then ts_rank(p.search_vector, v_tsq) * 4 else 0 end
            + case when v_q is not null
                   then greatest(extensions.similarity(p.search_text, v_q_norm),
                                 extensions.word_similarity(v_q_norm, p.search_text))
                   else 0 end)::real as rank
      from candidates c
      join public.products p on p.id = c.id
     where (not v_variant_filters or c.any_passes)
       and (   (v_q is null and v_code is null)
            or c.exact_code or c.prefix_code
            or (v_tsq is not null and p.search_vector @@ v_tsq)
            or (v_q is not null and extensions.word_similarity(v_q_norm, p.search_text) >= 0.4)
            or (v_q is not null and length(v_q_norm) >= 3 and p.search_text like '%' || v_q_norm || '%'))
  ),
  priced as (
    select m.*,
           (select min(up.unit_price_net)
              from public.product_variants pv2
              cross join lateral private.unit_price_for(pv2.id, 1) up
             where pv2.product_id = m.id and pv2.status = 'active') as min_net
      from matched m
  ),
  stocked as (
    select pr.*,
           (select coalesce(max(private.available_qty(pv3.id)), 0)
              from public.product_variants pv3
             where pv3.product_id = pr.id and pv3.status = 'active') as best_available
      from priced pr
  )
  select s.id, s.slug, s.name, s.product_kind,
         b.name, mf.name, sy.name,
         s.category_id, s.requires_professional,
         (select pm.storage_path from public.product_media pm
           where pm.product_id = s.id order by pm.sort_order, pm.created_at limit 1),
         s.variant_count, s.matched,
         v_price_visible,
         case when v_price_visible then s.min_net end,
         case when v_price_visible and s.min_net is not null then
           (select case when p2.tax_class = 'iva' then round(s.min_net * (1 + v_rate))::bigint else s.min_net end
              from public.products p2 where p2.id = s.id)
         end,
         case when s.best_available <= 0 then 'out_of_stock'
              when s.best_available <= v_threshold then 'low_stock'
              else 'in_stock' end,
         s.rank,
         count(*) over ()
    from stocked s
    left join public.brands b on b.id = s.brand_id
    left join public.manufacturers mf on mf.id = s.manufacturer_id
    left join public.implant_systems sy on sy.id = s.implant_system_id
   where not coalesce(p_in_stock_only, false) or s.best_available > 0
   order by
     case when p_sort = 'relevance' then s.rank end desc nulls last,
     case when p_sort = 'price_asc' and v_price_visible then s.min_net end asc nulls last,
     case when p_sort = 'price_desc' and v_price_visible then s.min_net end desc nulls last,
     case when p_sort = 'newest' then s.created_at end desc nulls last,
     s.name asc
   limit v_limit offset v_offset;
end
$$;

-- Sugerencias mientras se escribe: nombres de productos, marcas, sistemas y categorías.
create function public.search_suggestions(p_prefix text, p_limit int default 8)
returns table (suggestion text, kind text)
language sql stable
set search_path = ''
as $$
  with q as (select lower(private.f_unaccent(trim(coalesce(p_prefix, '')))) as v)
  select s.suggestion, s.kind
    from (
      select p.name as suggestion, 'product' as kind,
             extensions.word_similarity(q.v, lower(private.f_unaccent(p.name))) as score
        from public.products p, q
       where length(q.v) >= 2
         and (lower(private.f_unaccent(p.name)) like q.v || '%'
              or lower(private.f_unaccent(p.name)) like '% ' || q.v || '%'
              or extensions.word_similarity(q.v, lower(private.f_unaccent(p.name))) >= 0.5)
      union all
      select b.name, 'brand', extensions.word_similarity(q.v, lower(private.f_unaccent(b.name)))
        from public.brands b, q
       where length(q.v) >= 2 and b.is_active
         and extensions.word_similarity(q.v, lower(private.f_unaccent(b.name))) >= 0.5
      union all
      select s.name, 'system', extensions.word_similarity(q.v, lower(private.f_unaccent(s.name)))
        from public.implant_systems s, q
       where length(q.v) >= 2 and s.is_active
         and extensions.word_similarity(q.v, lower(private.f_unaccent(s.name))) >= 0.5
      union all
      select c.name, 'category', extensions.word_similarity(q.v, lower(private.f_unaccent(c.name)))
        from public.categories c, q
       where length(q.v) >= 2 and c.is_active
         and extensions.word_similarity(q.v, lower(private.f_unaccent(c.name))) >= 0.5
    ) s
   group by s.suggestion, s.kind
   order by max(s.score) desc, s.suggestion
   limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;
