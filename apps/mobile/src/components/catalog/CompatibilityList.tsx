import {
  COMPATIBILITY_LABELS,
  COMPATIBILITY_SCOPE_LABELS,
  EVIDENCE_TYPE_LABELS,
  formatDateTime,
  PRODUCT_KINDS,
  type EvidenceType,
} from '@repo/domain';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Badge, Card, Divider, ErrorState, ListItem, Skeleton } from '@/components/ui';
import { useCompatibleComponents } from '@/features/catalog/api';

/**
 * Componentes compatibles VERIFICADOS para la medida seleccionada (CMP-01..03).
 * Sin vínculo verificado se informa "pendiente de verificación"; nunca se infiere.
 */
export function CompatibilityList({ implantVariantId }: { implantVariantId: string | null }) {
  const query = useCompatibleComponents(implantVariantId);

  return (
    <Card>
      <View style={{ gap: 12 }}>
        <AppText variant="title">Componentes compatibles</AppText>
        {!implantVariantId ? (
          <AppText color="textMuted">Selecciona una medida para ver sus componentes compatibles verificados.</AppText>
        ) : query.isPending ? (
          <View style={{ gap: 8 }}>
            <Skeleton height={18} />
            <Skeleton height={18} width="70%" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.length === 0 ? (
          <View style={{ gap: 8 }}>
            <Badge label={COMPATIBILITY_LABELS.unverified} tone="warning" />
            <AppText color="textMuted">
              Aún no hay componentes con compatibilidad verificada y documentada para esta medida. Consulta a un asesor
              antes de comprar componentes.
            </AppText>
          </View>
        ) : (
          <View>
            {query.data.map((c, i) => (
              <View key={c.link_id}>
                {i > 0 ? <Divider /> : null}
                <ListItem
                  title={c.component_name}
                  subtitle={[
                    PRODUCT_KINDS[c.component_kind]?.label,
                    c.brand_name,
                    COMPATIBILITY_SCOPE_LABELS[c.implant_scope],
                    `Fuente: ${EVIDENCE_TYPE_LABELS[c.evidence_type as EvidenceType] ?? c.evidence_type}${
                      c.evidence_reference ? ` (${c.evidence_reference})` : ''
                    }`,
                    `Verificado el ${formatDateTime(c.verified_at)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => router.push({ pathname: '/producto/[slug]', params: { slug: c.component_slug } })}
                />
              </View>
            ))}
            <AppText variant="caption" color="textMuted" style={{ marginTop: 8 }}>
              Información técnica de referencia según documentación del fabricante. No reemplaza el criterio profesional.
            </AppText>
          </View>
        )}
      </View>
    </Card>
  );
}
