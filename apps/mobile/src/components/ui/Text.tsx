import type { BrandPalette } from '@repo/brand';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useAppTheme } from '@/theme/theme';

export type TextVariant = 'display' | 'headline' | 'title' | 'bodyLarge' | 'body' | 'caption' | 'label';

export interface AppTextProps extends RNTextProps {
  variant?: TextVariant;
  color?: keyof BrandPalette;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color = 'text', weight, align, style, ...props }: AppTextProps) {
  const { colors, font } = useAppTheme();
  const size = {
    display: font.sizes.display,
    headline: font.sizes.headline,
    title: font.sizes.title,
    bodyLarge: font.sizes.bodyLarge,
    body: font.sizes.body,
    caption: font.sizes.caption,
    label: font.sizes.body,
  }[variant];
  const defaultWeight: TextStyle['fontWeight'] =
    variant === 'display' || variant === 'headline' ? '700' : variant === 'title' || variant === 'label' ? '600' : '400';
  return (
    <RNText
      accessibilityRole={variant === 'display' || variant === 'headline' || variant === 'title' ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      style={[
        {
          color: colors[color],
          fontSize: size,
          lineHeight: Math.round(size * 1.35),
          fontWeight: weight ?? defaultWeight,
          fontFamily: font.fontFamily,
          textAlign: align,
        },
        style,
      ]}
      {...props}
    />
  );
}
