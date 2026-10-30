import type { ProductKind } from '@repo/domain';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { kindIllustration } from '@/features/catalog/category-icons';
import { useAppTheme } from '@/theme/theme';

/**
 * Relleno para productos sin foto: ilustración genérica de su tipo, rotulada como referencial
 * para no hacerla pasar por la foto del producto. Ocupa todo el contenedor.
 */
export function ProductImageFallback({ kind, compact = false }: { kind: ProductKind; compact?: boolean }) {
  const { colors } = useAppTheme();
  const illustration = kindIllustration(kind);
  if (!illustration) return <Icon name="image" size={compact ? 28 : 44} color={colors.border} />;
  return (
    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={illustration}
        contentFit="contain"
        accessibilityLabel="Imagen referencial del tipo de producto"
        style={{ width: compact ? '72%' : '58%', height: compact ? '72%' : '70%' }}
      />
      {compact ? null : (
        <AppText variant="caption" color="textMuted" style={{ position: 'absolute', bottom: 8, fontSize: 10.5 }}>
          Imagen referencial
        </AppText>
      )}
    </View>
  );
}
