import { formatCalendarDate, normalizeCode, parseGs1, type Gs1Data } from '@repo/domain';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/catalog/ProductCard';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Screen, Skeleton } from '@/components/ui';
import { useCatalogSearch } from '@/features/catalog/api';
import { useAppTheme } from '@/theme/theme';

interface ScanResult {
  raw: string;
  gs1: Gs1Data | null;
  code: string;
}

/**
 * Búsqueda por código del envase (BUS-07): lee GS1/UDI (DataMatrix, GS1-128) o códigos EAN/QR,
 * muestra coincidencias PROBABLES y pide confirmación abriendo la ficha. Nunca confirma compatibilidad.
 */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScanResult | null>(null);
  const handled = useRef(false);

  if (!permission) return <LoadingState label="Preparando cámara…" />;

  if (!permission.granted) {
    return (
      <Screen>
        <EmptyState
          icon="scan"
          title="Permiso de cámara"
          message="Usamos la cámara solo para leer el código del envase y buscar el producto. No guardamos imágenes."
          actionLabel={permission.canAskAgain ? 'Permitir cámara' : 'Abrir configuración'}
          onAction={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        />
        <Button title="Buscar manualmente" variant="ghost" onPress={() => router.replace('/buscar')} />
      </Screen>
    );
  }

  if (result) {
    return (
      <ScanResultView
        result={result}
        onRetry={() => {
          handled.current = false;
          setResult(null);
        }}
      />
    );
  }

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current || !data) return;
    handled.current = true;
    const gs1 = parseGs1(data);
    setResult({ raw: data, gs1, code: gs1?.gtin ?? normalizeCode(data) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['datamatrix', 'code128', 'ean13', 'ean8', 'upc_a', 'qr'] }}
        onBarcodeScanned={onScanned}
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.frame} />
        <AppText style={styles.hint}>Apunta al código de barras o DataMatrix del envase</AppText>
      </View>
    </View>
  );
}

function ScanResultView({ result, onRetry }: { result: ScanResult; onRetry: () => void }) {
  const { spacing } = useAppTheme();
  const parsed = useMemo(() => ({ raw: result.code, text: '', codeCandidate: result.code }), [result.code]);
  const search = useCatalogSearch(parsed, { sort: 'relevance' }, result.code.length >= 3);
  const items = search.data?.pages.flat() ?? [];
  const gs1 = result.gs1;

  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button title="Escanear otro código" icon="scan" onPress={onRetry} />
          <Button
            title="Buscar manualmente"
            variant="outline"
            onPress={() => router.replace({ pathname: '/buscar', params: { q: result.code } })}
          />
        </View>
      }>
      <Card>
        <View style={{ gap: 6 }}>
          <AppText variant="title">Código leído</AppText>
          <AppText selectable>{gs1?.gtin ? `GTIN ${gs1.gtin}` : result.code}</AppText>
          {gs1?.lot ? <AppText>Lote: {gs1.lot}</AppText> : null}
          {gs1?.expiryDate ? <AppText>Vencimiento: {formatCalendarDate(gs1.expiryDate)}</AppText> : null}
          {gs1 && gs1.gtinValid === false ? (
            <AppText color="warning">El dígito verificador del GTIN no es válido: la lectura puede ser incorrecta.</AppText>
          ) : null}
          <AppText variant="caption" color="textMuted">
            La lectura sirve para identificar el producto. No confirma compatibilidad técnica: revísala en la ficha.
          </AppText>
        </View>
      </Card>

      {search.isPending ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={110} />
        </View>
      ) : search.isError ? (
        <ErrorState error={search.error} onRetry={() => search.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="search"
          title="Sin coincidencias confiables"
          message="No encontramos un producto con este código. Prueba escanear de nuevo o busca manualmente."
        />
      ) : (
        <ScrollView contentContainerStyle={{ gap: spacing.md }}>
          <AppText variant="label">{items.length === 1 ? 'Coincidencia probable' : 'Coincidencias probables'} — confírmala en la ficha:</AppText>
          {items.map((item) => (
            <ProductCard key={item.product_id} item={item} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 24 },
  frame: { width: 260, height: 180, borderWidth: 3, borderColor: '#19C3B8', borderRadius: 16 },
  hint: { color: '#FFFFFF', textAlign: 'center', paddingHorizontal: 32, fontWeight: '600' },
});
