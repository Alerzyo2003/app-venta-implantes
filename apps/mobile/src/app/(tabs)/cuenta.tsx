import { brand } from '@repo/brand';
import { ACCOUNT_TYPE_LABELS, toAppError, whatsappMessages } from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { WhatsAppButton } from '@/components/WhatsAppButton';
import { AppText, Badge, Button, Card, Divider, Icon, ListItem, Screen } from '@/components/ui';
import { useProfile } from '@/features/account/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSignOut } from '@/features/auth/api';
import { useAppTheme } from '@/theme/theme';

const PRO_STATUS = {
  not_requested: { label: 'Sin verificación profesional', tone: 'neutral' },
  pending: { label: 'Verificación en revisión', tone: 'warning' },
  verified: { label: 'Profesional verificado', tone: 'success' },
  rejected: { label: 'Verificación rechazada', tone: 'danger' },
} as const;

export default function AccountScreen() {
  const { user } = useAuth();
  const profile = useProfile();
  const signOut = useSignOut();
  const { colors, radius, spacing, fill } = useAppTheme();

  if (!user) {
    return (
      <Screen>
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="account" size={30} color={colors.primary} />
            </View>
            <AppText variant="headline">Te damos la bienvenida a {brand.name}</AppText>
            <AppText color="textMuted">Inicia sesión o crea tu cuenta para comprar, guardar favoritos y seguir tus pedidos.</AppText>
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Button title="Iniciar sesión" onPress={() => router.push('/iniciar-sesion')} />
              <Button title="Crear cuenta" variant="outline" onPress={() => router.push('/registro')} />
            </View>
          </View>
        </Card>
        <WhatsAppButton message={whatsappMessages.support()} />
      </Screen>
    );
  }

  const status = profile.data ? PRO_STATUS[profile.data.professional_status] : null;
  const displayName = profile.data?.full_name || user.email || '';
  const initials =
    displayName
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '?';

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="title" style={{ color: colors.onPrimary }}>
              {initials}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="title" numberOfLines={1}>
              {displayName}
            </AppText>
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {user.email}
              {profile.data ? ` · ${ACCOUNT_TYPE_LABELS[profile.data.account_type]}` : ''}
            </AppText>
            {status ? <Badge label={status.label} tone={status.tone} /> : null}
          </View>
        </View>
      </Card>

      <Card style={{ paddingVertical: spacing.sm }}>
        <ListItem icon="account" title="Datos personales" onPress={() => router.push('/cuenta/perfil')} />
        <Divider />
        <ListItem icon="location" title="Direcciones de despacho" onPress={() => router.push('/cuenta/direcciones')} />
        <Divider />
        <ListItem icon="receipt" title="Datos de facturación" onPress={() => router.push('/cuenta/facturacion')} />
        <Divider />
        <ListItem icon="verified" title="Verificación profesional" onPress={() => router.push('/cuenta/verificacion')} />
        <Divider />
        <ListItem icon="bell" title="Comunicaciones" subtitle="Correo, WhatsApp y notificaciones" onPress={() => router.push('/cuenta/preferencias')} />
        <Divider />
        <ListItem icon="shield" title="Seguridad y cuenta" subtitle="Sesiones y eliminación de cuenta" onPress={() => router.push('/cuenta/seguridad')} />
      </Card>

      <WhatsAppButton message={whatsappMessages.support()} />

      <Button
        title="Cerrar sesión"
        variant="ghost"
        icon="logout"
        loading={signOut.isPending}
        onPress={() => signOut.mutate('local')}
      />
      {signOut.isError ? (
        <AppText color="danger" align="center">
          {toAppError(signOut.error).message}
        </AppText>
      ) : null}
    </Screen>
  );
}
