import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, toAppError } from '@repo/domain';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, Card, EmptyState, LoadingState, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { completeSessionFromUrl, useUpdatePassword } from '@/features/auth/api';

/** Destino del enlace de recuperación: valida el enlace y permite fijar una contraseña nueva. */
export default function NewPasswordScreen() {
  const url = Linking.useLinkingURL();
  const { session } = useAuth();
  const [linkState, setLinkState] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const update = useUpdatePassword();
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = url ? await completeSessionFromUrl(url) : false;
        if (!cancelled) setLinkState(ok || session ? 'ok' : 'invalid');
      } catch {
        if (!cancelled) setLinkState('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo se procesa el enlace con el que se abrió la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (linkState === 'checking') return <LoadingState label="Validando enlace…" />;
  if (linkState === 'invalid') {
    return (
      <Screen>
        <EmptyState
          icon="warning"
          title="Enlace inválido o vencido"
          message="Solicita un nuevo enlace de recuperación."
          actionLabel="Solicitar enlace"
          onAction={() => router.replace('/recuperar-clave')}
        />
      </Screen>
    );
  }
  if (update.isSuccess) {
    return (
      <Screen>
        <EmptyState icon="checkCircle" title="Contraseña actualizada" actionLabel="Ir al inicio" onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <View style={{ gap: 16 }}>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                label="Nueva contraseña"
                password
                autoComplete="new-password"
                helper="Mínimo 10 caracteres, con letras y números."
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors.password?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="passwordConfirm"
            render={({ field }) => (
              <TextField
                label="Repite la contraseña"
                password
                autoComplete="new-password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors.passwordConfirm?.message}
              />
            )}
          />
          {update.isError ? <AppText color="danger">{toAppError(update.error).message}</AppText> : null}
          <Button title="Guardar contraseña" loading={update.isPending} onPress={() => void handleSubmit((v) => update.mutate(v.password))()} />
        </View>
      </Card>
    </Screen>
  );
}
