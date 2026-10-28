import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartButton } from '@/components/cart/CartButton';
import { ProductCard } from '@/components/catalog/ProductCard';
import { AppText, Chip, EmptyState, ErrorState, LoadingState, OfflineBanner, Skeleton } from '@/components/ui';
import { useCatalogSearch, useCategories } from '@/features/catalog/api';
import { useAppTheme } from '@/theme/theme';

/** Listado por categoría (incluye subcategorías). "Ofertas y destacados" muestra productos destacados. */
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, spacing } = useAppTheme();
  const categories = useCategories();
  const category = categories.data?.find((c) => c.slug === slug);
  const featuredMode = slug === 'ofertas-destacados';
  const results = useCatalogSearch(
    null,
    featuredMode ? { featuredOnly: true, sort: 'newest' } : { categoryId: category?.id, sort: 'name' },
    featuredMode || !!category,
  );
  const items = results.data?.pages.flat() ?? [];
  const subcategories = (categories.data ?? []).filter((c) => category && c.parent_id === category.id);

  if (categories.isPending) return <LoadingState />;
  if (categories.isError) return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;
  if (!category) {
    return <EmptyState icon="help" title="Categoría no encontrada" actionLabel="Ver categorías" onAction={() => router.replace('/categorias')} />;
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen options={{ title: category.name, headerRight: () => <CartButton /> }} />
      <OfflineBanner />
      <FlatList
        data={items}
        keyExtractor={(i) => i.product_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshing={results.isRefetching}
        onRefresh={() => results.refetch()}
        ListHeaderComponent={
          subcategories.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {subcategories.map((s) => (
                <Chip key={s.id} label={s.name} onPress={() => router.push({ pathname: '/categoria/[slug]', params: { slug: s.slug } })} />
              ))}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          results.isPending ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={110} />
              <Skeleton height={110} />
            </View>
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : (
            <EmptyState icon="package" title="Sin productos publicados" message="Esta categoría aún no tiene productos publicados." />
          )
        }
        renderItem={({ item }) => <ProductCard item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
        ListFooterComponent={
          results.isFetchingNextPage ? (
            <AppText color="textMuted" align="center">
              Cargando más…
            </AppText>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
