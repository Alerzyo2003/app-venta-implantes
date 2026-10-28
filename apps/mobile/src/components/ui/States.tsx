import { toAppError } from '@repo/domain';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, View, type DimensionValue } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { AppText } from './Text';

export function EmptyState({
  icon = 'info',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, spacing } = useAppTheme();
  return (
    <View accessibilityRole="summary" style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg }}>
      <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, padding: spacing.lg }}>
        <Icon name={icon} size={32} color={colors.primary} />
      </View>
      <AppText variant="title" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText color="textMuted" align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        // El contenedor centra el botón (que por sí solo se alinea al inicio cuando no ocupa todo el ancho).
        <View>
          <Button title={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

/** Estado de error con mensaje en español y reintento. Nunca muestra detalles técnicos. */
export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const appError = toAppError(error);
  const offline = appError.code === 'NETWORK';
  return (
    <EmptyState
      icon={offline ? 'offline' : 'warning'}
      title={title ?? (offline ? 'Sin conexión' : 'No pudimos cargar la información')}
      message={offline ? 'Revisa tu conexión a internet e intenta nuevamente.' : appError.message}
      actionLabel={onRetry ? 'Reintentar' : undefined}
      onAction={onRetry}
    />
  );
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  const { colors, spacing } = useAppTheme();
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  // Sin conexión las consultas quedan en pausa: se informa en vez de mostrar una carga infinita.
  if (!online) {
    return (
      <EmptyState
        icon="offline"
        title="Sin conexión"
        message="Mostraremos esta información cuando vuelva la conexión."
      />
    );
  }
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ padding: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
      <ActivityIndicator color={colors.primary} />
      <AppText color="textMuted">{label}</AppText>
    </View>
  );
}

/** Bloque de carga animado; respeta la opción "reducir movimiento" del sistema. */
export function Skeleton({ height = 16, width = '100%', radius = 8 }: { height?: number; width?: DimensionValue; radius?: number }) {
  const { colors } = useAppTheme();
  const [opacity] = useState(() => new Animated.Value(0.6));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width, borderRadius: radius, backgroundColor: colors.surfaceAlt, opacity }}
    />
  );
}
