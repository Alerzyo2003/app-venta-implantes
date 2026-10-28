import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, toAppError } from '@repo/domain';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen, TextField } from '@/components/ui';
import { useRequestPasswordReset } from '@/features/auth/api';

export default function ForgotPasswordScreen() {
  const reset = useRequestPasswordReset();
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  if (reset.isSuccess) {
    return (
      <Screen>
        <EmptyState
          icon="mail"
          title="Revisa tu correo"
          message="Si existe una cuenta con ese correo, recibirás un enlace para crear una nueva contraseña. El enlace vence en una hora."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <View style={{ gap: 16 }}>
          <AppText color="textMuted">Te enviaremos un enlace para crear una nueva contraseña.</AppText>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Correo electrónico"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors.email?.message}
              />
            )}
          />
          {reset.isError ? <AppText color="danger">{toAppError(reset.error).message}</AppText> : null}
          <Button title="Enviar enlace" loading={reset.isPending} onPress={() => void handleSubmit((v) => reset.mutate(v.email))()} />
        </View>
      </Card>
    </Screen>
  );
}
