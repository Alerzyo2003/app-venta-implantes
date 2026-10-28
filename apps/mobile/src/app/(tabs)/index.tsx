import { brand } from '@repo/brand';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { ProductCard } from '@/components/catalog/ProductCard';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, Icon, Screen, SectionHeader, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCatalogSearch, useCategories } from '@/features/catalog/api';
import { usePublicSettings } from '@/features/settings/api';
import { useAppTheme } from '@/theme/theme';

export default function HomeScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const { user } = useAuth();
  const settings = usePublicSettings();
  const categories = useCategories();
  const featured = useCatalogSearch(null, { featuredOnly: true, sort: 'newest' });
  const featuredItems = featured.data?.pages.flat().slice(0, 10) ?? [];
  const topCategories = (categories.data ?? []).filter((c) => !c.parent_id);

  return (
    <Screen
      refreshing={featured.isRefetching || categories.isRefetching}
      onRefresh={() => {
        featured.refetch();
        categories.refetch();
      }}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="headline">{brand.tagline}</AppText>
        <AppText color="textMuted">Busca por nombre, código, sistema o medidas (por ejemplo «implante 4.0 x 10 mm»).</AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Buscar productos"
          onPress={() => router.push('/buscar')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: 48,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.background,
          }}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <AppText color="textMuted">Buscar implantes, componentes, insumos…</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leer el código del envase con la cámara"
          onPress={() => router.push('/escanear')}
          style={{
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.md,
            backgroundColor: colors.primary,
          }}>
          <Icon name="scan" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      {!user && settings.data?.pricingVisibility !== 'public' ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <AppText variant="title">Precios y compras para profesionales</AppText>
            <AppText color="textMuted">Crea tu cuenta para ver precios, comprar y consultar tus pedidos desde cualquier dispositivo.</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button title="Crear cuenta" onPress={() => router.push('/registro')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Iniciar sesión" variant="outline" onPress={() => router.push('/iniciar-sesion')} />
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Categorías" action="Ver todas" onAction={() => router.push('/categorias')} />
        {categories.isPending ? (
          <Skeleton height={36} />
        ) : categories.isError ? (
          <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {topCategories.map((c) => (
              <Chip key={c.id} label={c.name} onPress={() => router.push({ pathname: '/categoria/[slug]', params: { slug: c.slug } })} />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Destacados" />
        {featured.isPending ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        ) : featured.isError ? (
          <ErrorState error={featured.error} onRetry={() => featured.refetch()} />
        ) : featuredItems.length === 0 ? (
          <EmptyState
            icon="package"
            title="Aún no hay productos destacados"
            message="Cuando el equipo publique productos destacados aparecerán aquí."
            actionLabel="Explorar categorías"
            onAction={() => router.push('/categorias')}
          />
        ) : (
          featuredItems.map((item) => <ProductCard key={item.product_id} item={item} />)
        )}
      </View>
    </Screen>
  );
}
