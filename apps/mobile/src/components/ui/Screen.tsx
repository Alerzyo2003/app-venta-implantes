import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme';

import { OfflineBanner } from './OfflineBanner';

export interface ScreenProps {
  children: ReactNode;
  /** false para pantallas con FlatList propia. */
  scroll?: boolean;
  /** Bordes con área segura (los encabezados nativos ya cubren el superior). */
  edges?: Edge[];
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  contentStyle?: ViewStyle;
  background?: 'background' | 'surface';
}

export function Screen({
  children,
  scroll = true,
  edges = ['left', 'right'],
  padded = true,
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  background = 'surface',
}: ScreenProps) {
  const { colors, spacing } = useAppTheme();
  const padding = padded ? spacing.lg : 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors[background] }} edges={edges}>
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ padding, gap: spacing.lg, paddingBottom: spacing.xxl }, contentStyle]}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
              ) : undefined
            }>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, padding }, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <SafeAreaView
            edges={['bottom']}
            style={{
              backgroundColor: colors.background,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
            }}>
            {footer}
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
