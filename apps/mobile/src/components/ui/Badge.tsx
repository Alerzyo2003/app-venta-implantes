import { View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { AppText } from './Text';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const { colors, radius } = useAppTheme();
  const map = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
    success: { bg: colors.successSurface, fg: colors.success },
    warning: { bg: colors.warningSurface, fg: colors.warning },
    danger: { bg: colors.dangerSurface, fg: colors.danger },
    info: { bg: colors.infoSurface, fg: colors.info },
    accent: { bg: colors.surfaceAlt, fg: colors.accentText },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}>
      <AppText variant="caption" weight="600" style={{ color: map.fg }}>
        {label}
      </AppText>
    </View>
  );
}
