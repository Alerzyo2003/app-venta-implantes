import { brand } from '@repo/brand';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartButton } from '@/components/cart/CartButton';
import { FeaturedProductCard } from '@/components/catalog/FeaturedProductCard';
import { AppText, Button, EmptyState, ErrorState, Icon, OfflineBanner, Skeleton, type IconName } from '@/components/ui';
import { useProfile } from '@/features/account/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCatalogSearch, useCategories } from '@/features/catalog/api';
import { categoryIcon, categoryImage, ILLUSTRATIONS } from '@/features/catalog/category-icons';
import { usePublicSettings } from '@/features/settings/api';
import { useAppTheme } from '@/theme/theme';

const VALUE_PROP_ICONS: Record<(typeof brand.valueProps)[number]['icon'], IconName> = {
  shipping: 'shipping',
  original: 'shieldCheck',
  support: 'support',
};

/** Tintes suaves para el círculo de cada categoría (se repiten en orden). */
const TILE_TINTS = {
  light: ['#DCE9FF', '#E9E1FF', '#D9F5F1', '#DDF0FF'],
  dark: ['#1C3560', '#2B2756', '#173F45', '#183A5C'],
};

const WHITE = '#FFFFFF';

export default function HomeScreen() {
  const { colors, radius, spacing, scheme, card, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const profile = useProfile();
  const settings = usePublicSettings();
  const categories = useCategories();
  const featured = useCatalogSearch(null, { featuredOnly: true, sort: 'newest' });
  const featuredItems = featured.data?.pages.flat().slice(0, 10) ?? [];
  const topCategories = (categories.data ?? []).filter((c) => !c.parent_id);
  const dark = scheme === 'dark';
  const gradients = brand.gradients[scheme];

  // La cabecera es azul en ambos modos: la barra de estado usa texto claro solo en esta pantalla.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(dark ? 'light' : 'dark');
    }, [dark]),
  );

  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={featured.isRefetching || categories.isRefetching}
            onRefresh={() => {
              featured.refetch();
              categories.refetch();
            }}
            tintColor={WHITE}
            progressViewOffset={insets.top}
          />
        }>
        {/* Cabecera de marca */}
        <View
          style={{
            backgroundImage: gradients.hero,
            backgroundColor: '#1746C2',
            paddingTop: insets.top + spacing.md,
            paddingHorizontal: spacing.lg + 4,
            paddingBottom: spacing.xl,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            overflow: 'hidden',
          }}>
          {/* Destellos decorativos */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: -60, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(96, 165, 250, 0.35)' }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: insets.top + 128,
              right: 12,
              width: 140,
              height: 46,
              borderRadius: 85,
              borderWidth: 2,
              borderColor: 'rgba(125, 249, 255, 0.55)',
              transform: [{ rotate: '-16deg' }],
            }}
          />
          <Image
            source={ILLUSTRATIONS.implant}
            accessible={false}
            contentFit="contain"
            style={{ position: 'absolute', top: insets.top + 50, right: 24, width: 124, height: 124, transform: [{ rotate: '14deg' }] }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 6px 16px rgba(25, 195, 184, 0.45)',
              }}>
              <AppText weight="800" style={{ color: colors.onAccent, fontSize: 22, lineHeight: 26 }}>
                {brand.name.charAt(0)}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" weight="800" style={{ color: WHITE }} numberOfLines={1}>
                {brand.name}
              </AppText>
              <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.78)' }} numberOfLines={1}>
                {brand.slogan}
              </AppText>
            </View>
            {user ? (
              <View style={{ borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                <CartButton color={WHITE} />
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.xs, maxWidth: '70%' }}>
            <AppText variant="caption" weight="700" style={{ color: 'rgba(255,255,255,0.75)', letterSpacing: 2.2, fontSize: 11 }}>
              {user && firstName ? `HOLA, ${firstName.toUpperCase()}` : 'TODO PARA TU CLÍNICA'}
            </AppText>
            <AppText variant="display" style={{ color: WHITE, fontSize: 30, lineHeight: 35 }}>
              ¿Qué necesitas{'\n'}
              <AppText variant="display" style={{ color: '#5EEAD4', fontSize: 30, lineHeight: 35 }}>
                hoy?
              </AppText>
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
            <Pressable
              accessibilityRole="search"
              accessibilityLabel="Buscar productos"
              onPress={() => router.push('/buscar')}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 54,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.pill,
                backgroundColor: dark ? colors.surface : WHITE,
                opacity: pressed ? 0.92 : 1,
                boxShadow: '0px 8px 24px rgba(6, 22, 60, 0.25)',
              })}>
              <Icon name="search" size={22} color={colors.textMuted} />
              <AppText color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
                Implantes, pilares, insumos…
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leer el código del envase con la cámara"
              onPress={() => router.push('/escanear')}
              style={({ pressed }) => ({
                width: 54,
                height: 54,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 18,
                backgroundColor: colors.accent,
                opacity: pressed ? 0.88 : 1,
                boxShadow: '0px 8px 20px rgba(25, 195, 184, 0.40)',
              })}>
              <Icon name="scan" size={24} color={colors.onAccent} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            {brand.valueProps.map((v) => (
              <View key={v.icon} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name={VALUE_PROP_ICONS[v.icon]} size={24} color={WHITE} />
                <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.88)', flex: 1, fontSize: 11.5, lineHeight: 15 }}>
                  {v.text}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <OfflineBanner />

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xl }}>
          {!user && settings.data?.pricingVisibility !== 'public' ? (
            <View style={{ backgroundImage: gradients.promo, backgroundColor: card, borderRadius: 24, padding: spacing.lg + 4, overflow: 'hidden', ...shadow.md }}>
              {/* Ilustración sobre un pedestal */}
              <View
                pointerEvents="none"
                style={{ position: 'absolute', right: -30, top: 18, width: 190, height: 190, borderRadius: 95, backgroundColor: dark ? 'rgba(96,165,250,0.12)' : 'rgba(37, 99, 235, 0.08)' }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: 10,
                  bottom: 92,
                  width: 130,
                  height: 26,
                  borderRadius: 65,
                  backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                  boxShadow: dark ? 'none' : '0px 6px 14px rgba(11,37,69,0.10)',
                }}
              />
              <Image source={ILLUSTRATIONS.abutment} accessible={false} contentFit="contain" style={{ position: 'absolute', right: 80, bottom: 100, width: 50, height: 66 }} />
              <Image source={ILLUSTRATIONS.implant} accessible={false} contentFit="contain" style={{ position: 'absolute', right: 28, bottom: 102, width: 66, height: 98 }} />
              <Image
                source={ILLUSTRATIONS.offer}
                accessible={false}
                contentFit="contain"
                style={{ position: 'absolute', right: 10, top: 14, width: 54, height: 54, transform: [{ rotate: '12deg' }] }}
              />

              <View style={{ maxWidth: '60%', gap: spacing.xs }}>
                <AppText variant="caption" weight="700" style={{ color: colors.highlight, letterSpacing: 2, fontSize: 11 }}>
                  PRECIOS ESPECIALES
                </AppText>
                <AppText variant="headline" style={{ fontSize: 28, lineHeight: 32 }}>
                  Para{'\n'}
                  <AppText variant="headline" style={{ fontSize: 28, lineHeight: 32, color: colors.highlight }}>
                    profesionales
                  </AppText>
                </AppText>
                <AppText color="textMuted" style={{ marginTop: spacing.xs }}>
                  Crea tu cuenta para ver precios, comprar y seguir tus pedidos desde cualquier dispositivo.
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                <View style={{ flex: 1.2 }}>
                  <Button title="Crear cuenta" icon="arrowRight" iconPosition="right" onPress={() => router.push('/registro')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Ingresar" variant="outline" onPress={() => router.push('/iniciar-sesion')} />
                </View>
              </View>
            </View>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <SectionTitle title="Categorías" action="Ver todas" onAction={() => router.push('/categorias')} />
            {categories.isPending ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} height={168} width={112} radius={22} />
                ))}
              </View>
            ) : categories.isError ? (
              <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -spacing.lg }}
                contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                {topCategories.map((c, i) => {
                  const tints = TILE_TINTS[scheme];
                  const tint = tints[i % tints.length];
                  const image = categoryImage(c.slug);
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityLabel={c.name}
                      onPress={() => router.push({ pathname: '/categoria/[slug]', params: { slug: c.slug } })}
                      style={({ pressed }) => ({
                        width: 112,
                        minHeight: 168,
                        padding: spacing.sm + 2,
                        gap: spacing.sm,
                        borderRadius: 22,
                        backgroundColor: card,
                        opacity: pressed ? 0.88 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        ...shadow.sm,
                      })}>
                      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
                        {image ? (
                          <Image source={image} accessible={false} contentFit="contain" style={{ width: 62, height: 62 }} />
                        ) : (
                          <Icon name={categoryIcon(c.slug)} size={30} color={colors.primary} />
                        )}
                      </View>
                      <AppText variant="caption" weight="700" numberOfLines={3} style={{ fontSize: 13, lineHeight: 17, flex: 1 }}>
                        {c.name}
                      </AppText>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="arrowRight" size={16} color={colors.highlight} />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={{ gap: spacing.md }}>
            <SectionTitle title="Destacados" action={featuredItems.length > 0 ? 'Ver todos' : undefined} onAction={() => router.push('/buscar')} />
            {featured.isPending ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Skeleton height={250} width={164} radius={radius.lg} />
                <Skeleton height={250} width={164} radius={radius.lg} />
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -spacing.lg }}
                contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                {featuredItems.map((item) => (
                  <FeaturedProductCard key={item.product_id} item={item} width={164} />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="headline" style={{ fontSize: 24, lineHeight: 30 }}>
        {title}
      </AppText>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText weight="700" style={{ color: colors.highlight }}>
            {action}
          </AppText>
          <Icon name="arrowRight" size={18} color={colors.highlight} />
        </Pressable>
      ) : null}
    </View>
  );
}
