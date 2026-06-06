import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuctionDetail } from '@/api/hooks/useAuctions';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function AuctionDetailScreen() {
  const theme = useTheme();
  const { usuario } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalogoItemId = Number(id);
  const { data: vm, isLoading, isError, refetch } = useAuctionDetail(
    catalogoItemId,
    usuario?.categoria,
  );
  const [favorite, setFavorite] = useState(false);

  if (isLoading) {
    return (
      <Screen padded>
        <ScreenHeader title="Subasta" />
        <LoadingState />
      </Screen>
    );
  }

  if (isError || !vm) {
    return (
      <Screen padded>
        <ScreenHeader title="Subasta" />
        <ErrorState message="No pudimos cargar la subasta." onRetry={refetch} />
      </Screen>
    );
  }

  const isLive = vm.status === 'live';

  // Real Articulo fields, dropping any spec with no data.
  const specs = [
    { label: 'Referencia', value: vm.numeroPieza || null },
    { label: 'Año', value: vm.fechaObra || null },
    { label: 'Artista', value: vm.artista || null },
    {
      label: 'Elementos',
      value: vm.cantidadElementos > 1 ? String(vm.cantidadElementos) : null,
    },
  ].filter((s): s is { label: string; value: string } => !!s.value);

  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerOverlay}>
          <ScreenHeader
            rightIcon={favorite ? 'heart' : 'heart-outline'}
            onRightPress={() => setFavorite((f) => !f)}
          />
        </View>
        <Image source={{ uri: vm.images[0] }} style={styles.hero} contentFit="cover" />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            {vm.artista ? <Badge label={vm.artista} tone="gold" /> : null}
            <Badge
              label={vm.statusLabel}
              tone={isLive ? 'live' : 'upcoming'}
              dot={isLive}
            />
          </View>
          <ThemedText type="title">{vm.title}</ThemedText>

          <Card elevated style={styles.bidCard}>
            <View style={styles.flex}>
              <ThemedText type="caption" themeColor="textSecondary">
                Puja actual
              </ThemedText>
              <ThemedText type="price" style={styles.bigPrice}>
                ${vm.currentBid.toLocaleString('en-US')}
              </ThemedText>
            </View>
            {vm.timingLabel ? (
              <View style={styles.timer}>
                <Icon name="time-outline" size={16} color={theme.primary} />
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {vm.timingLabel}
                </ThemedText>
              </View>
            ) : null}
          </Card>

          {specs.length ? (
            <View style={styles.section}>
              <ThemedText type="heading">Especificaciones</ThemedText>
              <Card padded={false}>
                {specs.map((s, i) => (
                  <View
                    key={s.label}
                    style={[
                      styles.specRow,
                      i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {s.label}
                    </ThemedText>
                    <ThemedText type="smallBold">{s.value}</ThemedText>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {vm.description ? (
            <View style={styles.section}>
              <ThemedText type="heading">Historia & Procedencia</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
                {vm.description}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {vm.locked ? (
          <>
            <Button title="Acceso restringido" fullWidth disabled />
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              style={styles.lockNote}>
              Requiere categoría mínima {vm.categoriaMinima}.
            </ThemedText>
          </>
        ) : isLive ? (
          <Button
            title="Entrar a la sala en vivo"
            fullWidth
            onPress={() => router.push(`/live/${catalogoItemId}`)}
          />
        ) : (
          <>
            <Button
              title={
                vm.status === 'upcoming'
                  ? 'Subasta no iniciada'
                  : vm.vendido
                    ? 'Lote vendido'
                    : 'Subasta finalizada'
              }
              fullWidth
              disabled
            />
            {vm.status === 'upcoming' && vm.timingLabel ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.lockNote}>
                {vm.timingLabel}
              </ThemedText>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.four,
  },
  hero: { width: '100%', height: 320, backgroundColor: '#0E121A' },
  body: { padding: Spacing.four, gap: Spacing.four },
  titleRow: { flexDirection: 'row', gap: Spacing.two },
  bidCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  bigPrice: { fontSize: 28, lineHeight: 34 },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(233,195,73,0.1)',
  },
  section: { gap: Spacing.three },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  desc: { lineHeight: 22 },
  footer: { padding: Spacing.four, borderTopWidth: 1, paddingBottom: Spacing.five, gap: Spacing.two },
  lockNote: { textAlign: 'center' },
});
