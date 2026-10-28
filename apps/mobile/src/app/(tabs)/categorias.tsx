import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Divider, EmptyState, ErrorState, ListItem, LoadingState, Screen } from '@/components/ui';
import { useCategories, type Category } from '@/features/catalog/api';

export default function CategoriesScreen() {
  const categories = useCategories();

  if (categories.isPending) return <LoadingState />;
  if (categories.isError) {
    return (
      <Screen>
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      </Screen>
    );
  }

  const all = categories.data;
  const top = all.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => all.filter((c) => c.parent_id === id);
  const open = (c: Category) => router.push({ pathname: '/categoria/[slug]', params: { slug: c.slug } });

  return (
    <Screen refreshing={categories.isRefetching} onRefresh={() => categories.refetch()}>
      {top.length === 0 ? (
        <EmptyState icon="categories" title="Sin categorías" message="Aún no hay categorías publicadas." />
      ) : (
        <Card>
          {top.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <ListItem title={c.name} onPress={() => open(c)} />
              {childrenOf(c.id).map((sub) => (
                <View key={sub.id} style={{ paddingLeft: 16 }}>
                  <ListItem title={sub.name} subtitle="Subcategoría" onPress={() => open(sub)} />
                </View>
              ))}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
