import { parseSearchQuery, PRODUCT_KINDS, type ProductKind } from '@repo/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/catalog/ProductCard';
import { AppText, Button, Chip, EmptyState, ErrorState, Icon, IconButton, OfflineBanner, Skeleton } from '@/components/ui';
import { useCatalogSearch, useSuggestions, type SearchFilters } from '@/features/catalog/api';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '@/lib/recent-searches';
import { fontStyle, useAppTheme } from '@/theme/theme';

const SORTS: { value: NonNullable<SearchFilters['sort']>; label: string }[] = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
  { value: 'name', label: 'Nombre' },
  { value: 'newest', label: 'Novedades' },
];

const KIND_FILTERS: ProductKind[] = ['implant', 'abutment', 'transfer', 'screw', 'analog', 'healing_abutment', 'biomaterial', 'instrument'];

export default function SearchScreen() {
  const { colors, radius, spacing, font, card, shadow } = useAppTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState(params.q ?? '');
  const [filters, setFilters] = useState<SearchFilters>({ sort: 'relevance' });
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecent);
  }, []);

  const parsed = useMemo(() => (submitted.trim() ? parseSearchQuery(submitted) : null), [submitted]);
  const hasCriteria = !!parsed || !!filters.productKinds?.length || filters.inStockOnly;
  const results = useCatalogSearch(parsed, filters, hasCriteria);
  const suggestions = useSuggestions(text !== submitted ? text : '');
  const items = results.data?.pages.flat() ?? [];
  const total = results.data?.pages[0]?.[0]?.total_count ?? 0;

  const submit = async (term: string) => {
    setText(term);
    setSubmitted(term);
    if (term.trim()) setRecent(await saveRecentSearch(term));
  };

  const toggleKind = (kind: ProductKind) =>
    setFilters((f) => {
      const current = f.productKinds ?? [];
      return { ...f, productKinds: current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind] };
    });

  const interpretation = parsed
    ? [
        parsed.diameterMm !== undefined ? `Ø ${parsed.diameterMm} mm` : null,
        parsed.lengthMm !== undefined ? `longitud ${parsed.lengthMm} mm` : null,
        parsed.codeCandidate ? `código ${parsed.codeCandidate}` : null,
      ].filter(Boolean)
    : [];

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <OfflineBanner />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, backgroundColor: colors.surface }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: card,
            borderRadius: radius.md,
            paddingLeft: spacing.lg,
            paddingRight: spacing.xs,
            ...shadow.sm,
          }}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput
            autoFocus={!params.q}
            accessibilityLabel="Buscar en el catálogo"
            placeholder="Nombre, código, sistema o «4.0 x 10 mm»"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => submit(text)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={[
              { flex: 1, minHeight: 52, color: colors.text, fontSize: font.sizes.bodyLarge, ...fontStyle('500') },
              // En web el foco ya se indica en el contenedor.
              Platform.OS === 'web' ? { outlineWidth: 0 } : null,
            ]}
          />
          {text ? <IconButton icon="close" accessibilityLabel="Borrar búsqueda" onPress={() => submit('')} color={colors.textMuted} /> : null}
          <IconButton icon="scan" accessibilityLabel="Leer código del envase" onPress={() => router.push('/escanear')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip
            label="Con stock"
            selected={!!filters.inStockOnly}
            onPress={() => setFilters((f) => ({ ...f, inStockOnly: !f.inStockOnly }))}
          />
          {KIND_FILTERS.map((k) => (
            <Chip key={k} label={PRODUCT_KINDS[k].label} selected={filters.productKinds?.includes(k)} onPress={() => toggleKind(k)} />
          ))}
        </ScrollView>
        {hasCriteria ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} selected={filters.sort === s.value} onPress={() => setFilters((f) => ({ ...f, sort: s.value }))} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {suggestions.data && suggestions.data.length > 0 && text !== submitted ? (
        <View style={{ backgroundColor: card, marginHorizontal: spacing.lg, borderRadius: radius.md, paddingHorizontal: spacing.sm, ...shadow.sm }}>
          {suggestions.data.map((s) => (
            <Button key={`${s.kind}-${s.suggestion}`} title={s.suggestion} variant="ghost" icon="search" onPress={() => submit(s.suggestion)} />
          ))}
        </View>
      ) : null}

      {!hasCriteria ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          {recent.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="title">Búsquedas recientes</AppText>
                <Button
                  title="Borrar"
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={async () => {
                    await clearRecentSearches();
                    setRecent([]);
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {recent.map((r) => (
                  <Chip key={r} label={r} onPress={() => submit(r)} />
                ))}
              </View>
            </>
          ) : (
            <EmptyState
              icon="search"
              title="Busca en el catálogo"
              message="Puedes escribir el nombre, la marca, el sistema, el código del fabricante o medidas como «4.0 x 10 mm»."
            />
          )}
        </ScrollView>
      ) : results.isPending ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
        </View>
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.product_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          ListHeaderComponent={
            <View style={{ gap: 4 }}>
              <AppText color="textMuted">
                {total === 1 ? '1 resultado' : `${total} resultados`}
                {interpretation.length > 0 ? ` · Interpretado: ${interpretation.join(', ')}` : ''}
              </AppText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="Sin resultados"
              message="Prueba con otra palabra, revisa el código o quita filtros. También puedes consultar a un asesor."
            />
          }
          renderItem={({ item }) => <ProductCard item={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
          ListFooterComponent={results.isFetchingNextPage ? <Skeleton height={110} /> : undefined}
        />
      )}
    </SafeAreaView>
  );
}
