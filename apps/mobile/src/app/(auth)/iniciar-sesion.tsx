import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, toAppError } from '@repo/domain';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { useSignIn } from '@/features/auth/api';

export default function SignInScreen() {
  const signIn = useSignIn();
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn.mutateAsync(values);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      // El error se muestra abajo (signIn.error).
    }
  });

  return (
    <Screen>
      <Card>
        <View style={{ gap: 16 }}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Correo electrónico"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                label="Contraseña"
                password
                autoComplete="current-password"
                textContentType="password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                onSubmitEditing={() => void onSubmit()}
                error={formState.errors.password?.message}
              />
            )}
          />
          {signIn.isError ? (
            <AppText color="danger" accessibilityLiveRegion="polite">
              {toAppError(signIn.error).message}
            </AppText>
          ) : null}
          <Button title="Iniciar sesión" loading={signIn.isPending} onPress={() => void onSubmit()} />
          <Link href="/recuperar-clave" style={{ alignSelf: 'center', padding: 8 }}>
            <AppText color="accentText" weight="600">
              ¿Olvidaste tu contraseña?
            </AppText>
          </Link>
        </View>
      </Card>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <AppText color="textMuted">¿Aún no tienes cuenta?</AppText>
        <Button title="Crear cuenta" variant="outline" onPress={() => router.replace('/registro')} />
      </View>
    </Screen>
  );
}
