import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { Icon } from './Icon';
import { AppText } from './Text';

/** Aviso visible sin conexión: se puede consultar lo ya cargado, pero no comprar (SYN-02). */
export function OfflineBanner() {
  const { colors, spacing } = useAppTheme();
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningSurface, padding: spacing.md }}>
      <Icon name="offline" size={18} color={colors.warning} />
      <AppText variant="caption" style={{ color: colors.warning, flex: 1 }}>
        Sin conexión. Puedes revisar la información ya cargada; las compras y cambios esperan a que vuelva la conexión.
      </AppText>
    </View>
  );
}
