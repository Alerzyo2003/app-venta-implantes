import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Chip, ErrorState, ListItem, Skeleton, TextField } from '@/components/ui';
import { useTerritory } from '@/features/account/api';
import { useAppTheme } from '@/theme/theme';

/** Selección de región y comuna con los códigos oficiales (CUT). */
export function ComunaPicker({ value, onChange, error }: { value: string; onChange: (code: string) => void; error?: string }) {
  const { spacing } = useAppTheme();
  const territory = useTerritory();
  const selected = territory.data?.comunas.find((c) => c.code === value);
  const [region, setRegion] = useState<string | null>(selected?.region_code ?? null);
  const [filter, setFilter] = useState('');

  const options = useMemo(() => {
    const list = territory.data?.comunas ?? [];
    const f = filter.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return list.filter(
      (c) =>
        (!region || c.region_code === region) &&
        (!f || c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(f)),
    );
  }, [territory.data, region, filter]);

  if (territory.isPending) return <Skeleton height={48} />;
  if (territory.isError) return <ErrorState error={territory.error} onRetry={() => territory.refetch()} />;

  const regionName = territory.data.regions.find((r) => r.code === selected?.region_code)?.short_name;

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">Comuna</AppText>
      {selected ? (
        <AppText>
          Seleccionada: {selected.name}
          {regionName ? `, ${regionName}` : ''}
        </AppText>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {territory.data.regions.map((r) => (
          <Chip key={r.code} label={r.short_name} selected={region === r.code} onPress={() => setRegion(region === r.code ? null : r.code)} />
        ))}
      </ScrollView>
      <TextField label="Buscar comuna" value={filter} onChangeText={setFilter} autoCorrect={false} error={error} />
      {filter.trim() || region ? (
        <View style={{ maxHeight: 260 }}>
          <ScrollView nestedScrollEnabled>
            {options.slice(0, 60).map((c) => (
              <ListItem
                key={c.code}
                title={c.name}
                icon={c.code === value ? 'checkCircle' : undefined}
                onPress={() => {
                  onChange(c.code);
                  setFilter('');
                }}
              />
            ))}
            {options.length === 0 ? <AppText color="textMuted">Sin coincidencias.</AppText> : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
