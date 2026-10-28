import { formatCLP } from '@repo/domain';
import { View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { AppText } from './Text';

/**
 * Precio con IVA (bruto) destacado y neto como referencia. Si el usuario no puede ver precios
 * se muestra el motivo real en lugar de un valor.
 */
export function PriceTag({
  gross,
  net,
  visible,
  hiddenReason = 'Inicia sesión para ver precios',
  size = 'md',
  prefix,
}: {
  gross: number | null | undefined;
  net?: number | null;
  visible: boolean;
  hiddenReason?: string;
  size?: 'md' | 'lg';
  prefix?: string;
}) {
  const { spacing } = useAppTheme();
  if (!visible) {
    return (
      <AppText variant="caption" color="textMuted">
        {hiddenReason}
      </AppText>
    );
  }
  if (gross == null) {
    return (
      <AppText variant="caption" color="textMuted">
        Precio no disponible
      </AppText>
    );
  }
  return (
    <View style={{ gap: spacing.xs / 2 }}>
      <AppText variant={size === 'lg' ? 'headline' : 'title'} color="primary">
        {prefix ? `${prefix} ` : ''}
        {formatCLP(gross)}
      </AppText>
      <AppText variant="caption" color="textMuted">
        IVA incluido{net != null ? ` · ${formatCLP(net)} + IVA` : ''}
      </AppText>
    </View>
  );
}
