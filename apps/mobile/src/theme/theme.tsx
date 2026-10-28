import { brand, type BrandPalette, type ColorScheme } from '@repo/brand';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export interface AppTheme {
  scheme: ColorScheme;
  colors: BrandPalette;
  spacing: typeof brand.spacing;
  radius: typeof brand.radius;
  font: typeof brand.typography;
}

function buildTheme(scheme: ColorScheme): AppTheme {
  return {
    scheme,
    colors: brand.palettes[scheme],
    spacing: brand.spacing,
    radius: brand.radius,
    font: brand.typography,
  };
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
  const { scheme, colors } = useAppTheme();
  return useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [scheme, colors]);
}
