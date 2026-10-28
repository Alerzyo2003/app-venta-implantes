import { brand } from '@repo/brand';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Card, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/theme';

/**
 * Se muestra si la app se compiló sin las variables del backend. No se simulan datos (P-02).
 */
export function ConfigMissing() {
  const { colors, spacing } = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, padding: spacing.lg, justifyContent: 'center' }}>
      <Card>
        <View style={{ gap: spacing.md, alignItems: 'flex-start' }}>
          <Icon name="warning" size={32} color={colors.warning} />
          <AppText variant="headline">Configuración pendiente</AppText>
          <AppText>
            {brand.name} no tiene configurado el servidor. Define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en
            apps/mobile/.env.local (ver .env.example) y reinicia la app.
          </AppText>
          <AppText variant="caption" color="textMuted">
            Mientras tanto la app no muestra productos ni precios: nunca se usan datos ficticios.
          </AppText>
        </View>
      </Card>
    </SafeAreaView>
  );
}
