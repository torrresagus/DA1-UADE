import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { bidderLabel } from '@/api/adapters';
import { useAuctionDetail, useMejorOferta, usePujasItem } from '@/api/hooks/useAuctions';
import { useLiveSubasta } from '@/api/hooks/useLiveSubasta';
import { useMediosPago } from '@/api/hooks/useMediosPago';
import { num } from '@/api/types';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function LiveRoomScreen() {
  const theme = useTheme();
  const { usuario, usuarioId } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalogoItemId = Number(id);

  const mejorQuery = useMejorOferta(catalogoItemId);
  const pujasQuery = usePujasItem(catalogoItemId);
  const detailQuery = useAuctionDetail(catalogoItemId, usuario?.categoria);
  const { data: medios } = useMediosPago(usuarioId);
  const hasVerifiedMedio = !!medios?.some((m) => m.verificado);
  // Real-time updates: refresh best offer + history on each broadcast bid.
  const live = useLiveSubasta(detailQuery.data?.subastaId ?? null, usuarioId);

  const mejor = mejorQuery.data;
  const detail = detailQuery.data;

  if (usuarioId == null) {
    return (
      <Screen padded>
        <ScreenHeader title="Sala en vivo" />
        <EmptyState icon="person-outline" message="Iniciá sesión para pujar." />
        <Button title="Iniciar sesión" fullWidth onPress={() => router.push('/(auth)/login')} />
      </Screen>
    );
  }

  const isLoading = mejorQuery.isLoading || detailQuery.isLoading;
  const isError = mejorQuery.isError || detailQuery.isError;

  if (isLoading) {
    return (
      <Screen padded>
        <ScreenHeader title="Sala en vivo" />
        <LoadingState />
      </Screen>
    );
  }

  if (isError || !mejor) {
    return (
      <Screen padded>
        <ScreenHeader title="Sala en vivo" />
        <ErrorState
          message="No pudimos cargar la sala."
          onRetry={() => {
            mejorQuery.refetch();
            detailQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  if (live.rejected) {
    return (
      <Screen padded>
        <ScreenHeader title="Sala en vivo" />
        <EmptyState
          icon="alert-circle-outline"
          message="Ya estás conectado a otra subasta. Salí de la otra sala para entrar acá."
        />
        <Button title="Volver" fullWidth onPress={() => router.back()} />
      </Screen>
    );
  }

  const currentBid = mejor.mejor_monto != null ? num(mejor.mejor_monto) : detail?.basePrice ?? 0;
  const suggested = num(mejor.minimo_proxima);
  const maximo = mejor.maximo_proxima != null ? num(mejor.maximo_proxima) : null;
  const rangeLabel = `Rango válido: $${suggested.toLocaleString('en-US')} – ${
    maximo != null ? `$${maximo.toLocaleString('en-US')}` : 'sin límite'
  }`;

  // History ASC from the backend -> render newest-first (copy before reverse).
  const history = [...(pujasQuery.data ?? [])].reverse();

  // Only an open, unsold lot accepts bids; the backend 400s otherwise.
  const isLive = detail?.status === 'live' && !detail?.vendido;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Sala en vivo" rightIcon="people-outline" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card padded={false} style={styles.stage}>
          <Image source={{ uri: detail?.images[0] }} style={styles.media} contentFit="cover" />
          <View style={styles.liveBadge}>
            <Badge
              label={detail?.statusLabel ?? 'En vivo'}
              tone={isLive ? 'live' : detail?.status === 'upcoming' ? 'upcoming' : 'neutral'}
              dot={isLive}
            />
          </View>
        </Card>

        <View style={styles.body}>
          <ThemedText type="heading">{detail?.title ?? 'Subasta en vivo'}</ThemedText>

          <Card elevated style={styles.currentBid}>
            <ThemedText type="caption" themeColor="textSecondary">
              Oferta actual
            </ThemedText>
            <ThemedText type="price" style={styles.bigPrice}>
              ${currentBid.toLocaleString('en-US')}
            </ThemedText>
          </Card>

          <Card style={styles.suggestCard}>
            <ThemedText type="caption" themeColor="textSecondary">
              Oferta sugerida (mínimo próxima)
            </ThemedText>
            <ThemedText type="heading" style={{ color: theme.primary }}>
              ${suggested.toLocaleString('en-US')}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {rangeLabel}
            </ThemedText>
          </Card>

          <View style={styles.section}>
            <ThemedText type="heading">Historial de pujas</ThemedText>
            <Card padded={false}>
              {history.length === 0 ? (
                <View style={styles.histEmpty}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Sé el primero en pujar.
                  </ThemedText>
                </View>
              ) : (
                history.map((puja, i) => {
                  const you = puja.usuario_id === usuarioId;
                  return (
                    <View
                      key={puja.id}
                      style={[
                        styles.histRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                      ]}>
                      <View style={styles.rowLeft}>
                        <Icon
                          name="person-circle-outline"
                          size={22}
                          color={you ? theme.primary : theme.textSecondary}
                        />
                        <ThemedText
                          type="small"
                          style={{ color: you ? theme.primary : theme.text }}>
                          {bidderLabel(puja.usuario_id, usuarioId)}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold">
                        ${num(puja.monto).toLocaleString('en-US')}
                      </ThemedText>
                    </View>
                  );
                })
              )}
            </Card>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {isLive && !hasVerifiedMedio ? (
          <>
            <Button
              title="Verificá un medio de pago para pujar"
              fullWidth
              onPress={() => router.push('/payments')}
            />
            <ThemedText type="caption" style={[styles.gateNote, { color: theme.warning }]}>
              Podés seguir la subasta, pero necesitás un medio de pago verificado para ofertar.
            </ThemedText>
          </>
        ) : isLive ? (
          <Button
            title={`Pujar $${suggested.toLocaleString('en-US')}`}
            fullWidth
            onPress={() =>
              router.push({
                pathname: '/bid-confirmation',
                params: {
                  catalogoItemId: String(catalogoItemId),
                  monto: String(suggested),
                  title: detail?.title ?? '',
                },
              })
            }
          />
        ) : (
          <Button
            title={
              detail?.vendido
                ? 'Lote vendido'
                : detail?.status === 'upcoming'
                  ? 'Subasta no iniciada'
                  : 'Subasta no disponible'
            }
            fullWidth
            disabled
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  stage: { marginHorizontal: Spacing.four, height: 220 },
  media: { width: '100%', height: '100%', backgroundColor: '#0E121A' },
  liveBadge: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  body: { padding: Spacing.four, gap: Spacing.four },
  currentBid: { alignItems: 'center', gap: Spacing.two },
  bigPrice: { fontSize: 32, lineHeight: 38 },
  suggestCard: { alignItems: 'center', gap: Spacing.one },
  section: { gap: Spacing.three },
  histEmpty: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.four, alignItems: 'center' },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  footer: { padding: Spacing.four, borderTopWidth: 1, paddingBottom: Spacing.five, gap: Spacing.two },
  gateNote: { textAlign: 'center' },
});
