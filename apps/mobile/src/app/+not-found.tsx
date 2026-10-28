import { router, Stack } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <EmptyState
        icon="help"
        title="No encontramos esta pantalla"
        message="El enlace puede estar incompleto o el contenido ya no existe."
        actionLabel="Ir al inicio"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
