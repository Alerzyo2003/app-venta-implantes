import { zodResolver } from '@hookform/resolvers/zod';
import { formatChileanPhone, profileUpdateSchema, toAppError } from '@repo/domain';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { RequireAuth } from '@/components/RequireAuth';
import { AppText, Button, Card, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { useProfile, useUpdateProfile, type Profile } from '@/features/account/api';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ProfileScreen() {
  return (
    <RequireAuth title="Datos personales" message="Inicia sesión para ver tus datos.">
      <ProfileLoader />
    </RequireAuth>
  );
}

function ProfileLoader() {
  const profile = useProfile();
  if (profile.isPending) return <LoadingState />;
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  return <ProfileForm profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { fullName: profile.full_name, phone: profile.phone ? formatChileanPhone(profile.phone) : '' },
  });

  return (
    <Screen>
      <Card>
        <View style={{ gap: 16 }}>
          <TextField label="Correo electrónico" value={user?.email ?? ''} editable={false} helper="El correo se usa para iniciar sesión." />
          <Controller
            control={control}
            name="fullName"
            render={({ field }) => (
              <TextField label="Nombre completo" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.fullName?.message} />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextField
                label="Teléfono"
                keyboardType="phone-pad"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors.phone?.message}
              />
            )}
          />
          {profile.rut ? <TextField label="RUT" value={profile.rut} editable={false} helper="Se registra con la verificación profesional." /> : null}
          {update.isError ? <AppText color="danger">{toAppError(update.error).message}</AppText> : null}
          {update.isSuccess ? <AppText color="success">Datos guardados.</AppText> : null}
          <Button
            title="Guardar"
            loading={update.isPending}
            onPress={() => void handleSubmit((v) => update.mutate(v as { fullName: string; phone: string }, { onSuccess: () => router.back() }))()}
          />
        </View>
      </Card>
    </Screen>
  );
}
