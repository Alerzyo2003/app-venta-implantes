import { brand } from '@repo/brand';
import { ACCOUNT_TYPE_LABELS, toAppError, whatsappMessages } from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { WhatsAppButton } from '@/components/WhatsAppButton';
import { AppText, Badge, Button, Card, Divider, ListItem, Screen } from '@/components/ui';
import { useProfile } from '@/features/account/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSignOut } from '@/features/auth/api';

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

  if (!user) {
    return (
      <Screen>
        <Card>
          <View style={{ gap: 12 }}>
            <AppText variant="headline">Te damos la bienvenida a {brand.name}</AppText>
            <AppText color="textMuted">Inicia sesión o crea tu cuenta para comprar, guardar favoritos y seguir tus pedidos.</AppText>
            <Button title="Iniciar sesión" onPress={() => router.push('/iniciar-sesion')} />
            <Button title="Crear cuenta" variant="outline" onPress={() => router.push('/registro')} />
          </View>
        </Card>
        <WhatsAppButton message={whatsappMessages.support()} />
      </Screen>
    );
  }

  const status = profile.data ? PRO_STATUS[profile.data.professional_status] : null;

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      <Card>
        <View style={{ gap: 6 }}>
          <AppText variant="title">{profile.data?.full_name || user.email}</AppText>
          <AppText color="textMuted">{user.email}</AppText>
          {profile.data ? <AppText variant="caption">{ACCOUNT_TYPE_LABELS[profile.data.account_type]}</AppText> : null}
          {status ? <Badge label={status.label} tone={status.tone} /> : null}
        </View>
      </Card>

      <Card>
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
