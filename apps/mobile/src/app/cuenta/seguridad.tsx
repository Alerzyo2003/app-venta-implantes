import { toAppError } from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useDeleteAccount } from '@/features/account/api';
import { useSignOut } from '@/features/auth/api';
import { confirmAction } from '@/lib/confirm';

export default function SecurityScreen() {
  return (
    <RequireAuth title="Seguridad" message="Inicia sesión para continuar.">
      <Content />
    </RequireAuth>
  );
}

function Content() {
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
  return (
    <Screen>
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="title">Sesiones</AppText>
          <AppText color="textMuted">Cierra la sesión en todos los dispositivos donde hayas ingresado (por ejemplo, si perdiste un teléfono).</AppText>
          <Button
            title="Cerrar sesión en todos los dispositivos"
            variant="outline"
            icon="logout"
            loading={signOut.isPending}
            onPress={async () => {
              const ok = await confirmAction({
                title: 'Cerrar todas las sesiones',
                message: 'Deberás iniciar sesión nuevamente en cada dispositivo.',
                confirmLabel: 'Cerrar sesiones',
              });
              if (ok) signOut.mutate('global', { onSuccess: () => router.replace('/') });
            }}
          />
          {signOut.isError ? <AppText color="danger">{toAppError(signOut.error).message}</AppText> : null}
        </View>
      </Card>
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="title">Eliminar mi cuenta</AppText>
          <AppText color="textMuted">
            Se eliminan tu perfil, direcciones, favoritos, carrito y preferencias. Los pedidos se conservan sin vínculo con tu
            cuenta durante el plazo que exige la normativa tributaria. No puedes eliminar la cuenta con pedidos en curso.
          </AppText>
          <Button
            title="Eliminar mi cuenta"
            variant="danger"
            icon="trash"
            loading={deleteAccount.isPending}
            onPress={async () => {
              const ok = await confirmAction({
                title: 'Eliminar cuenta',
                message: 'Esta acción es permanente y no se puede deshacer.',
                confirmLabel: 'Eliminar definitivamente',
                destructive: true,
              });
              if (ok) deleteAccount.mutate(undefined, { onSuccess: () => router.replace('/') });
            }}
          />
          {deleteAccount.isError ? <AppText color="danger">{toAppError(deleteAccount.error).message}</AppText> : null}
        </View>
      </Card>
    </Screen>
  );
}
