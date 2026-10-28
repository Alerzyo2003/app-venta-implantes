import type { ExpoConfig } from 'expo/config';

/**
 * Configuración dinámica de la app. La identidad es PROVISIONAL (nombre comercial pendiente, D-17)
 * y los identificadores definitivos dependen de las cuentas de Apple/Google (D-11): todo se
 * sobrescribe con variables de entorno, sin tocar el código.
 *
 * APP_VARIANT: development | preview | production (lo define cada perfil de eas.json).
 * Los colores deben coincidir con packages/brand/src/brand.ts.
 */
const variant = (process.env.APP_VARIANT ?? 'development') as 'development' | 'preview' | 'production';
const isProduction = variant === 'production';

const baseName = process.env.APP_DISPLAY_NAME ?? 'Marca provisional';
const baseId = process.env.APP_BUNDLE_ID ?? 'cl.marcaprovisional.implantes';
const idSuffix = isProduction ? '' : `.${variant === 'development' ? 'dev' : 'preview'}`;
const nameSuffix = isProduction ? '' : variant === 'development' ? ' (dev)' : ' (preview)';

const BRAND_PRIMARY = '#0B2545';

const config: ExpoConfig = {
  name: `${baseName}${nameSuffix}`,
  slug: process.env.EXPO_SLUG ?? 'app-venta-implantes',
  owner: process.env.EXPO_OWNER,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: process.env.APP_SCHEME ?? 'implantesapp',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: `${baseId}${idSuffix}`,
    supportsTablet: true,
    infoPlist: {
      // Solo se usa cifrado estándar (HTTPS): exento de declaración de exportación.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: `${baseId}${idSuffix}`,
    adaptiveIcon: {
      backgroundColor: BRAND_PRIMARY,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: BRAND_PRIMARY,
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission:
          'Usamos la cámara solo para leer el código del envase y buscar el producto en el catálogo.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appVariant: variant,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
};

export default config;
