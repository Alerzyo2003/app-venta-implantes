import { brand, type BrandPalette, type ColorScheme } from '@repo/brand';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

export interface AppTheme {
  scheme: ColorScheme;
  colors: BrandPalette;
  /** Fondo de tarjetas y superficies elevadas sobre el fondo de pantalla (`surface`). */
  card: string;
  /** Relleno suave sobre una tarjeta (campos, recuadros de íconos): contrasta con `card` en ambos modos. */
  fill: string;
  /** Sombras suaves; en modo oscuro las tarjetas se distinguen por color, no por sombra. */
  shadow: { sm: ViewStyle; md: ViewStyle };
  spacing: typeof brand.spacing;
  radius: typeof brand.radius;
  font: typeof brand.typography;
}

function buildTheme(scheme: ColorScheme): AppTheme {
  const colors = brand.palettes[scheme];
  const dark = scheme === 'dark';
  return {
    scheme,
    colors,
    card: dark ? colors.surfaceAlt : colors.background,
    fill: dark ? colors.surface : colors.surfaceAlt,
    shadow: {
      sm: { boxShadow: dark ? 'none' : '0px 1px 2px rgba(11, 37, 69, 0.05), 0px 4px 14px rgba(11, 37, 69, 0.06)' },
      md: { boxShadow: dark ? 'none' : '0px 2px 6px rgba(11, 37, 69, 0.06), 0px 12px 28px rgba(11, 37, 69, 0.10)' },
    },
    spacing: brand.spacing,
    radius: brand.radius,
    font: brand.typography,
  };
}

/**
 * Estilo de fuente para un peso. Con fuente propia se elige la familia del peso (Android no
 * sintetiza pesos de fuentes cargadas); sin ella se usa la del sistema con fontWeight.
 */
export function fontStyle(weight: TextStyle['fontWeight'] = '400'): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  const fonts = brand.typography.fonts;
  if (!fonts) return { fontFamily: brand.typography.fontFamily, fontWeight: weight };
  const w = String(weight);
  const fontFamily =
    w === '800' || w === '900'
      ? fonts.extrabold
      : w === '700' || w === 'bold'
        ? fonts.bold
        : w === '600'
          ? fonts.semibold
          : w === '500'
            ? fonts.medium
            : fonts.regular;
  return { fontFamily, fontWeight: 'normal' };
}

const ThemeContext = createContext<AppTheme>(buildTheme('light'));

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const theme = useMemo(() => buildTheme(system === 'dark' ? 'dark' : 'light'), [system]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}

/** Tema de navegación (encabezados, barra inferior) derivado de la marca. */
export function useNavigationTheme(): NavigationTheme {
  const { scheme, colors, card } = useAppTheme();
  return useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.surface,
        card,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [scheme, colors, card]);
}

/** Encabezado común de las pilas: se funde con el fondo, sin línea inferior y con la fuente de la marca. */
export function useHeaderOptions() {
  const { colors, font } = useAppTheme();
  return useMemo(
    () => ({
      headerTintColor: colors.primary,
      headerStyle: { backgroundColor: colors.surface },
      headerShadowVisible: false,
      headerTitleStyle: { color: colors.text, fontSize: font.sizes.bodyLarge, ...fontStyle('700') },
    }),
    [colors, font],
  );
}
