import { AVAILABILITY_LABELS, formatCLP, PRODUCT_KINDS } from '@repo/domain';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProductImageFallback } from '@/components/catalog/ProductImageFallback';
import { AppText, Icon } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { SearchResult } from '@/features/catalog/api';
import { useFavorites, useToggleFavorite } from '@/features/catalog/api';
import { productMediaUrl } from '@/lib/supabase';
import { useAppTheme } from '@/theme/theme';

/** Tarjeta vertical del carrusel de destacados: foto, favorito, nombre, precio y acceso a comprar. */
export function FeaturedProductCard({ item, width }: { item: SearchResult; width: number }) {
  const { colors, radius, spacing, card, fill, shadow } = useAppTheme();
  const { user } = useAuth();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = !!favorites.data?.some((f) => f.product_id === item.product_id);
  const hasPrice = item.price_visible && item.min_price_gross != null;
  const subtitle = item.brand_name ?? item.system_name ?? PRODUCT_KINDS[item.product_kind].label;
  const open = () => router.push({ pathname: '/producto/[slug]', params: { slug: item.slug } });
  const priceLabel = !item.price_visible
    ? 'Inicia sesión para ver precios'
    : item.min_price_gross == null
      ? 'Precio no disponible'
      : `${item.variant_count > 1 ? 'Desde ' : ''}${formatCLP(item.min_price_gross)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${subtitle}. ${AVAILABILITY_LABELS[item.availability]}. ${priceLabel}`}
      onPress={open}
      style={({ pressed }) => ({
        width,
        backgroundColor: card,
        borderRadius: radius.lg,
        padding: spacing.sm,
        gap: spacing.sm,
        opacity: pressed ? 0.94 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...shadow.sm,
      })}>
      <View style={[styles.image, { backgroundColor: fill, borderRadius: radius.md }]}>
        {item.image_path ? (
          <Image
            source={{ uri: productMediaUrl(item.image_path) }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <ProductImageFallback kind={item.product_kind} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          hitSlop={6}
          onPress={() =>
            user ? toggleFavorite.mutate({ productId: item.product_id, favorite: !isFavorite }) : router.push('/iniciar-sesion')
          }
          style={[styles.heart, { backgroundColor: card }]}>
          <Icon name={isFavorite ? 'heartFill' : 'heart'} size={18} color={isFavorite ? colors.danger : colors.textMuted} />
        </Pressable>
        {item.availability !== 'in_stock' || item.requires_professional ? (
          <View
            style={[
              styles.tag,
              {
                borderRadius: radius.pill,
                backgroundColor: item.availability === 'out_of_stock' ? colors.dangerSurface : item.availability === 'low_stock' ? colors.warningSurface : colors.infoSurface,
              },
            ]}>
            <AppText
              variant="caption"
              weight="700"
              style={{
                fontSize: 10.5,
                lineHeight: 13,
                color: item.availability === 'out_of_stock' ? colors.danger : item.availability === 'low_stock' ? colors.warning : colors.info,
              }}>
              {item.availability !== 'in_stock' ? AVAILABILITY_LABELS[item.availability] : 'Solo profesionales'}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: spacing.xs, gap: 2, flex: 1 }}>
        <AppText weight="700" numberOfLines={2} style={{ minHeight: 40 }}>
          {item.name}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.xs }}>
        <AppText
          numberOfLines={2}
          weight={hasPrice ? '800' : '500'}
          variant={hasPrice ? 'bodyLarge' : 'caption'}
          color={hasPrice ? 'text' : 'textMuted'}
          style={{ flex: 1 }}>
          {priceLabel}
        </AppText>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: 38, height: 38, borderRadius: radius.sm + 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="cart" size={19} color={colors.onAccent} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heart: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3 },
});
