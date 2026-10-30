import { View } from 'react-native';

import { useAppTheme } from '@/theme/theme';

import { AppText } from './Text';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const { colors, radius, fill } = useAppTheme();
  const map = {
    neutral: { bg: fill, fg: colors.textMuted },
    success: { bg: colors.successSurface, fg: colors.success },
    warning: { bg: colors.warningSurface, fg: colors.warning },
    danger: { bg: colors.dangerSurface, fg: colors.danger },
    info: { bg: colors.infoSurface, fg: colors.info },
    accent: { bg: fill, fg: colors.accentText },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}>
      <AppText variant="caption" weight="700" style={{ color: map.fg, fontSize: 11, lineHeight: 14 }}>
        {label}
      </AppText>
    </View>
  );
}
