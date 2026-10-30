/**
 * Identidad visual TEMPORAL de la plataforma.
 *
 * El nombre comercial está pendiente (decisión D-17). Para cambiar la marca basta con
 * editar este archivo: nombre, colores, tipografía y textos institucionales. Las apps
 * leen todo desde aquí; no hay colores ni nombres "hardcodeados" en las pantallas.
 */

export type ColorScheme = 'light' | 'dark';

export interface BrandPalette {
  /** Azul profundo: encabezados, botón primario, barra de navegación activa. */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Turquesa: acentos, fondos destacados, indicadores. No usar como texto sobre blanco. */
  accent: string;
  onAccent: string;
  /** Variante del acento apta para texto e íconos sobre el fondo. */
  accentText: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  info: string;
  infoSurface: string;
  overlay: string;
}

export interface Brand {
  /** Nombre visible. PROVISIONAL hasta definir la marca. */
  name: string;
  shortName: string;
  tagline: string;
  isProvisional: boolean;
  palettes: Record<ColorScheme, BrandPalette>;
  typography: {
    /** undefined = fuente del sistema (San Francisco en iOS, Roboto en Android). */
    fontFamily: string | undefined;
    /**
     * Familias por peso de la fuente propia (las apps nativas no sintetizan pesos de fuentes
     * cargadas). undefined = fuente del sistema con fontWeight.
     */
    fonts: { regular: string; medium: string; semibold: string; bold: string; extrabold: string } | undefined;
    sizes: {
      caption: number;
      body: number;
      bodyLarge: number;
      title: number;
      headline: number;
      display: number;
    };
  };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
}

export const brand: Brand = {
  name: 'Marca provisional',
  shortName: 'Provisional',
  tagline: 'Implantes dentales e insumos odontológicos',
  isProvisional: true,
  palettes: {
    light: {
      primary: '#0B2545',
      primaryPressed: '#071A33',
      onPrimary: '#FFFFFF',
      accent: '#19C3B8',
      onAccent: '#06283D',
      accentText: '#0A6E6A',
      background: '#FFFFFF',
      surface: '#F4F7FB',
      surfaceAlt: '#E8EFF7',
      border: '#D5DFEA',
      text: '#0B1B2B',
      textMuted: '#4A5B6E',
      textInverse: '#FFFFFF',
      success: '#1B7A35',
      successSurface: '#E6F4EA',
      warning: '#8A5300',
      warningSurface: '#FFF4E0',
      danger: '#B3261E',
      dangerSurface: '#FCE8E6',
      info: '#1A5DC8',
      infoSurface: '#E7F0FD',
      overlay: 'rgba(6, 18, 33, 0.45)',
    },
    dark: {
      primary: '#7FB4FF',
      primaryPressed: '#5E9BF0',
      onPrimary: '#04162B',
      accent: '#2DD4CB',
      onAccent: '#04201F',
      accentText: '#5EE0D8',
      background: '#08131F',
      surface: '#0F1E30',
      surfaceAlt: '#16293F',
      border: '#25394F',
      text: '#E8EEF5',
      textMuted: '#A3B3C6',
      textInverse: '#08131F',
      success: '#6BD38A',
      successSurface: '#12301D',
      warning: '#F2B455',
      warningSurface: '#33240C',
      danger: '#FF8A80',
      dangerSurface: '#3A1513',
      info: '#8AB8FF',
      infoSurface: '#13284A',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
  },
  typography: {
    // Plus Jakarta Sans (licencia OFL), cargada por la app con @expo-google-fonts.
    fontFamily: 'PlusJakartaSans_400Regular',
    fonts: {
      regular: 'PlusJakartaSans_400Regular',
      medium: 'PlusJakartaSans_500Medium',
      semibold: 'PlusJakartaSans_600SemiBold',
      bold: 'PlusJakartaSans_700Bold',
      extrabold: 'PlusJakartaSans_800ExtraBold',
    },
    sizes: { caption: 12, body: 15, bodyLarge: 17, title: 19, headline: 26, display: 32 },
  },
  radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
};
