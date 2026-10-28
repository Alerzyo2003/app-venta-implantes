import type { AvailabilityStatus, ParsedSearchQuery, ProductKind } from '@repo/domain';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase, supabase } from '@/lib/supabase';

export interface Category {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    enabled: !!supabase,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await getSupabase()
        .from('categories')
        .select('id, slug, name, parent_id, sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export interface SearchFilters {
  categoryId?: string;
  brandIds?: string[];
  systemIds?: string[];
  productKinds?: ProductKind[];
  diameterMm?: number;
  lengthMm?: number;
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'name' | 'newest';
}

export interface SearchResult {
  product_id: string;
  slug: string;
  name: string;
  product_kind: ProductKind;
  brand_name: string | null;
  manufacturer_name: string | null;
  system_name: string | null;
  requires_professional: boolean;
  image_path: string | null;
  variant_count: number;
  matched_variant_ids: string[];
  price_visible: boolean;
  min_price_net: number | null;
  min_price_gross: number | null;
  availability: AvailabilityStatus;
  total_count: number;
}

const PAGE_SIZE = 20;

/**
 * Búsqueda del catálogo. La consulta en texto libre se interpreta en el cliente con
 * @repo/domain (medidas y códigos) y el servidor aplica texto completo, trigramas y filtros.
 */
export function useCatalogSearch(parsed: ParsedSearchQuery | null, filters: SearchFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['catalog-search', parsed?.raw ?? '', filters],
    enabled: !!supabase && enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<SearchResult[]> => {
      const { data, error } = await getSupabase().rpc('search_catalog', {
        p_query: parsed?.text || null,
        p_code: parsed?.codeCandidate ?? null,
        p_category_id: filters.categoryId ?? null,
        p_brand_ids: filters.brandIds?.length ? filters.brandIds : null,
        p_system_ids: filters.systemIds?.length ? filters.systemIds : null,
        p_product_kinds: filters.productKinds?.length ? filters.productKinds : null,
        p_diameter_mm: filters.diameterMm ?? parsed?.diameterMm ?? null,
        p_length_mm: filters.lengthMm ?? parsed?.lengthMm ?? null,
        p_in_stock_only: filters.inStockOnly ?? false,
        p_featured_only: filters.featuredOnly ?? false,
        p_sort: filters.sort ?? 'relevance',
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.length, 0);
      const total = last[0]?.total_count ?? 0;
      return last.length === PAGE_SIZE && loaded < total ? loaded : undefined;
    },
  });
}

export function useSuggestions(prefix: string) {
  const term = prefix.trim();
  return useQuery({
    queryKey: ['suggestions', term],
    enabled: !!supabase && term.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<{ suggestion: string; kind: string }[]> => {
      const { data, error } = await getSupabase().rpc('search_suggestions', { p_prefix: term, p_limit: 6 });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface ProductVariant {
  id: string;
  sku: string;
  manufacturer_ref: string | null;
  label: string | null;
  diameter_mm: number | null;
  length_mm: number | null;
  status: 'active' | 'inactive' | 'discontinued';
  sort_order: number;
  platform: { code: string; name: string } | null;
  connection: { name: string } | null;
}

export interface ProductDocument {
  id: string;
  title: string;
  kind: string;
  external_url: string | null;
  storage_path: string | null;
  version: string | null;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  product_kind: ProductKind;
  short_description: string | null;
  description: string | null;
  usage_instructions: string | null;
  storage_conditions: string | null;
  requires_professional: boolean;
  tax_class: 'iva' | 'exempt';
  brand: { name: string } | null;
  manufacturer: { name: string } | null;
  system: { name: string } | null;
  category: { id: string; name: string; slug: string } | null;
  variants: ProductVariant[];
  media: { storage_path: string; alt_text: string | null; sort_order: number }[];
  documents: { document: ProductDocument | null }[];
}

const PRODUCT_SELECT = `
  id, slug, name, product_kind, short_description, description, usage_instructions, storage_conditions,
  requires_professional, tax_class,
  brand:brands!products_brand_id_fkey(name),
  manufacturer:manufacturers!products_manufacturer_id_fkey(name),
  system:implant_systems!products_implant_system_id_fkey(name),
  category:categories!products_category_id_fkey(id, name, slug),
  variants:product_variants!product_variants_product_id_fkey(
    id, sku, manufacturer_ref, label, diameter_mm, length_mm, status, sort_order,
    platform:platforms!product_variants_platform_id_fkey(code, name),
    connection:connection_types!product_variants_connection_type_id_fkey(name)
  ),
  media:product_media!product_media_product_id_fkey(storage_path, alt_text, sort_order),
  documents:product_documents!product_documents_product_id_fkey(
    document:documents!product_documents_document_id_fkey(id, title, kind, external_url, storage_path, version)
  )
`;

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    enabled: !!supabase && !!slug,
    queryFn: async (): Promise<ProductDetail | null> => {
      const { data, error } = await getSupabase().from('products').select(PRODUCT_SELECT).eq('slug', slug).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const product = data as unknown as ProductDetail;
      product.variants = [...product.variants]
        .filter((v) => v.status !== 'inactive')
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            (a.diameter_mm ?? 0) - (b.diameter_mm ?? 0) ||
            (a.length_mm ?? 0) - (b.length_mm ?? 0) ||
            a.sku.localeCompare(b.sku),
        );
      product.media = [...product.media].sort((a, b) => a.sort_order - b.sort_order);
      return product;
    },
  });
}

export interface VariantPrice {
  variant_id: string;
  price_visible: boolean;
  tax_class: 'iva' | 'exempt';
  unit_price_net: number | null;
  unit_price_gross: number | null;
  tiers: { min_quantity: number; unit_price_net: number }[] | null;
}

export function useVariantPrices(variantIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    // La visibilidad de precios depende de la sesión.
    queryKey: ['variant-prices', user?.id ?? 'anon', [...variantIds].sort()],
    enabled: !!supabase && variantIds.length > 0,
    queryFn: async (): Promise<Map<string, VariantPrice>> => {
      const { data, error } = await getSupabase().rpc('get_variant_prices', { p_variant_ids: variantIds });
      if (error) throw error;
      return new Map(((data ?? []) as VariantPrice[]).map((p) => [p.variant_id, p]));
    },
  });
}

export interface VariantAvailability {
  variant_id: string;
  status: AvailabilityStatus;
  available_qty: number | null;
}

export function useAvailability(variantIds: string[]) {
  return useQuery({
    queryKey: ['availability', [...variantIds].sort()],
    enabled: !!supabase && variantIds.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<Map<string, VariantAvailability>> => {
      const { data, error } = await getSupabase().rpc('get_availability', { p_variant_ids: variantIds });
      if (error) throw error;
      return new Map(((data ?? []) as VariantAvailability[]).map((a) => [a.variant_id, a]));
    },
  });
}

export interface CompatibleComponent {
  link_id: string;
  implant_scope: 'variant' | 'product' | 'platform';
  component_product_id: string;
  component_variant_id: string | null;
  component_name: string;
  component_slug: string;
  component_kind: ProductKind;
  brand_name: string | null;
  evidence_type: string;
  evidence_reference: string | null;
  evidence_document_id: string | null;
  verified_at: string;
}

/** Solo compatibilidades VERIFICADAS con evidencia (CMP-03). */
export function useCompatibleComponents(implantVariantId: string | null) {
  return useQuery({
    queryKey: ['compatible-components', implantVariantId],
    enabled: !!supabase && !!implantVariantId,
    queryFn: async (): Promise<CompatibleComponent[]> => {
      const { data, error } = await getSupabase().rpc('get_compatible_components', {
        p_implant_variant_id: implantVariantId,
      });
      if (error) throw error;
      return (data ?? []) as CompatibleComponent[];
    },
  });
}

export interface FavoriteRow {
  product_id: string;
  created_at: string;
  product: { id: string; slug: string; name: string; product_kind: ProductKind; brand: { name: string } | null } | null;
}

export function useFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['favorites', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<FavoriteRow[]> => {
      const { data, error } = await getSupabase()
        .from('favorites')
        .select('product_id, created_at, product:products!favorites_product_id_fkey(id, slug, name, product_kind, brand:brands!products_brand_id_fkey(name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FavoriteRow[];
    },
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, favorite }: { productId: string; favorite: boolean }) => {
      if (!user) throw new Error('NOT_AUTHENTICATED');
      const client = getSupabase();
      const { error } = favorite
        ? await client.from('favorites').insert({ user_id: user.id, product_id: productId })
        : await client.from('favorites').delete().eq('user_id', user.id).eq('product_id', productId);
      // Agregar un favorito ya existente no es un error para el usuario.
      if (error && error.code !== '23505') throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });
}
