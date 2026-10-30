import { brand } from '@repo/brand';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartButton } from '@/components/cart/CartButton';
import { ProductCard } from '@/components/catalog/ProductCard';
import { AppText, Button, EmptyState, ErrorState, Icon, OfflineBanner, SectionHeader, Skeleton } from '@/components/ui';
import { useProfile } from '@/features/account/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCatalogSearch, useCategories } from '@/features/catalog/api';
import { categoryIcon } from '@/features/catalog/category-icons';
import { usePublicSettings } from '@/features/settings/api';
import { useAppTheme } from '@/theme/theme';

export default function HomeScreen() {
  const { colors, radius, spacing, scheme, card, fill, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const profile = useProfile();
  const settings = usePublicSettings();
  const categories = useCategories();
  const featured = useCatalogSearch(null, { featuredOnly: true, sort: 'newest' });
  const featuredItems = featured.data?.pages.flat().slice(0, 10) ?? [];
  const topCategories = (categories.data ?? []).filter((c) => !c.parent_id);

  // La cabecera es oscura en modo claro: la barra de estado cambia a texto claro solo aquí.
  const dark = scheme === 'dark';
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(dark ? 'light' : 'dark');
    }, [dark]),
  );

  const heroBg = dark ? colors.surfaceAlt : colors.primary;
  const heroFg = dark ? colors.text : colors.onPrimary;
  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const gridGap = spacing.md;
  const tileWidth = (Math.min(width, 640) - spacing.lg * 2 - gridGap) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={featured.isRefetching || categories.isRefetching}
            onRefresh={() => {
              featured.refetch();
              categories.refetch();
            }}
            tintColor={heroFg}
            progressViewOffset={insets.top}
          />
        }>
        {/* Cabecera de marca */}
        <View
          style={{
            backgroundColor: heroBg,
            paddingTop: insets.top + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl + spacing.sm,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
            gap: spacing.lg,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.sm + 2,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText weight="800" style={{ color: colors.onAccent, fontSize: 17, lineHeight: 20 }}>
                {brand.name.charAt(0)}
              </AppText>
            </View>
            <AppText variant="bodyLarge" weight="700" style={{ color: heroFg, flex: 1 }} numberOfLines={1}>
              {brand.name}
            </AppText>
            <CartButton color={heroFg} />
          </View>

          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: heroFg, opacity: 0.75 }}>{user ? `Hola${firstName ? `, ${firstName}` : ''}` : 'Te damos la bienvenida'}</AppText>
            <AppText variant="display" style={{ color: heroFg }}>
              ¿Qué necesitas hoy?
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              accessibilityRole="search"
              accessibilityLabel="Buscar productos"
              onPress={() => router.push('/buscar')}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: 52,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.md,
                backgroundColor: dark ? colors.surface : card,
                opacity: pressed ? 0.9 : 1,
              })}>
              <Icon name="search" size={20} color={colors.textMuted} />
              <AppText color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
                Implantes, pilares, insumos…
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leer el código del envase con la cámara"
              onPress={() => router.push('/escanear')}
              style={({ pressed }) => ({
                width: 52,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: colors.accent,
                opacity: pressed ? 0.85 : 1,
              })}>
              <Icon name="scan" size={24} color={colors.onAccent} />
            </Pressable>
          </View>
        </View>

        <OfflineBanner />

        <View style={{ padding: spacing.lg, gap: spacing.xl }}>
          {!user && settings.data?.pricingVisibility !== 'public' ? (
            <View
              style={{
                backgroundColor: card,
                borderRadius: radius.lg,
                padding: spacing.lg,
                gap: spacing.md,
                borderLeftWidth: 4,
                borderLeftColor: colors.accent,
                ...shadow.sm,
              }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="title">Precios para profesionales</AppText>
                <AppText color="textMuted">Crea tu cuenta para ver precios, comprar y seguir tus pedidos desde cualquier dispositivo.</AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button title="Crear cuenta" size="sm" onPress={() => router.push('/registro')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Ingresar" size="sm" variant="outline" onPress={() => router.push('/iniciar-sesion')} />
                </View>
              </View>
            </View>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Categorías" action="Ver todas" onAction={() => router.push('/categorias')} />
            {categories.isPending ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Skeleton height={116} width={116} radius={radius.lg} />
                <Skeleton height={116} width={116} radius={radius.lg} />
                <Skeleton height={116} width={116} radius={radius.lg} />
              </View>
            ) : categories.isError ? (
              <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -spacing.lg }}
                contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
                {topCategories.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={c.name}
                    onPress={() => router.push({ pathname: '/categoria/[slug]', params: { slug: c.slug } })}
                    style={({ pressed }) => ({
                      width: 116,
                      minHeight: 116,
                      padding: spacing.md,
                      gap: spacing.sm,
                      borderRadius: radius.lg,
                      backgroundColor: card,
                      opacity: pressed ? 0.85 : 1,
                      ...shadow.sm,
                    })}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.sm + 4,
                        backgroundColor: fill,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Icon name={categoryIcon(c.slug)} size={22} color={colors.primary} />
                    </View>
                    <AppText variant="caption" weight="600" numberOfLines={3}>
                      {c.name}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Destacados" />
            {featured.isPending ? (
              <View style={{ flexDirection: 'row', gap: gridGap }}>
                <Skeleton height={tileWidth + 110} width={tileWidth} radius={radius.lg} />
                <Skeleton height={tileWidth + 110} width={tileWidth} radius={radius.lg} />
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gridGap }}>
                {featuredItems.map((item) => (
                  <ProductCard key={item.product_id} item={item} compact style={{ width: tileWidth }} />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
