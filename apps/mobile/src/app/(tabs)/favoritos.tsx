import { PRODUCT_KINDS } from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { Card, Divider, EmptyState, ErrorState, IconButton, ListItem, LoadingState, Screen } from '@/components/ui';
import { useFavorites, useToggleFavorite } from '@/features/catalog/api';

export default function FavoritesScreen() {
  return (
    <RequireAuth icon="heart" title="Tus favoritos" message="Inicia sesión para guardar productos y verlos en todos tus dispositivos.">
      <FavoritesList />
    </RequireAuth>
  );
}

function FavoritesList() {
  const favorites = useFavorites();
  const toggle = useToggleFavorite();

  if (favorites.isPending) return <LoadingState />;
  if (favorites.isError) {
    return (
      <Screen>
        <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
      </Screen>
    );
  }
  const rows = favorites.data.filter((f) => f.product);

  return (
    <Screen refreshing={favorites.isRefetching} onRefresh={() => favorites.refetch()}>
      {rows.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Aún no tienes favoritos"
          message="Toca el corazón en la ficha de un producto para guardarlo aquí."
          actionLabel="Buscar productos"
          onAction={() => router.push('/buscar')}
        />
      ) : (
        <Card>
          {rows.map((f, i) => (
            <View key={f.product_id}>
              {i > 0 ? <Divider /> : null}
              <ListItem
                title={f.product!.name}
                subtitle={[PRODUCT_KINDS[f.product!.product_kind]?.label, f.product!.brand?.name].filter(Boolean).join(' · ')}
                onPress={() => router.push({ pathname: '/producto/[slug]', params: { slug: f.product!.slug } })}
                right={
                  <IconButton
                    icon="heartFill"
                    accessibilityLabel={`Quitar ${f.product!.name} de favoritos`}
                    onPress={() => toggle.mutate({ productId: f.product_id, favorite: false })}
                  />
                }
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
