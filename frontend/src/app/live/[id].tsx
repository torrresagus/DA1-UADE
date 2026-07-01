import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { bidderLabel } from '@/api/adapters';
import { GuestAccessModal } from '@/components/guest-access-modal';
import { useAuctionDetail, useMejorOferta, usePujasItem } from '@/api/hooks/useAuctions';
import { useLiveSubasta } from '@/api/hooks/useLiveSubasta';
import { useMediosPago } from '@/api/hooks/useMediosPago';
import { queryKeys } from '@/api/query-client';
import { num } from '@/api/types';
import { fmtMoneyInput, fmtPrice } from '@/utils/format';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function LiveRoomScreen() {
  const theme = useTheme();
  const { usuario, usuarioId, isGuest } = useSession();
  const queryClient = useQueryClient();

  const { id } = useLocalSearchParams<{ id: string }>();
  const catalogoItemId = Number(id);

  const mejorQuery = useMejorOferta(catalogoItemId);
  const pujasQuery = usePujasItem(catalogoItemId);
  const detailQuery = useAuctionDetail(catalogoItemId, usuario?.categoria);
  const { data: medios } = useMediosPago(usuarioId);
  const hasVerifiedMedio = !!medios?.some((m) => m.verificado);
  const live = useLiveSubasta(detailQuery.data?.subastaId ?? null, usuarioId);

  // All hooks must be declared before any conditional return.
  const [bidInput, setBidInput] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [localClosed, setLocalClosed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando el backend confirma que la subasta cerró, invalida la lista del home.
  useEffect(() => {
    if (detail && (detail.status !== 'live' || detail.vendido)) {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots() });
    }
  }, [detail?.status, detail?.vendido]);

  // Cuando el timeout local de 20s dispara, también invalida el home.
  useEffect(() => {
    if (localClosed) {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots() });
    }
  }, [localClosed]);

  useEffect(() => {
    const closingTime = detail?.closingTime;
    if (!closingTime) { setTimeLeft(null); return; }
    setLocalClosed(false);

    const tick = () => {
      const diff = new Date(closingTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Cerrando…');
        mejorQuery.refetch();
        detailQuery.refetch();
        // Si en 20 segundos el backend no confirmó el cierre, forzamos el estado localmente
        if (!closingTimeoutRef.current) {
          closingTimeoutRef.current = setTimeout(() => {
            setLocalClosed(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
          }, 20_000);
        }
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (closingTimeoutRef.current) { clearTimeout(closingTimeoutRef.current); closingTimeoutRef.current = null; }
    };
  }, [detail?.closingTime]);

  const mejor = mejorQuery.data;
  const detail = detailQuery.data;

  const suggested = mejor ? num(mejor.minimo_proxima) : 0;
  const maximo = mejor?.maximo_proxima != null ? num(mejor.maximo_proxima) : null;

  // Pre-fill once data loads, only if the user hasn't typed anything yet.
  useEffect(() => {
    if (suggested > 0 && bidInput === '') setBidInput(fmtMoneyInput(String(suggested)));
  }, [suggested]);

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
  const moneda = detail?.moneda ?? 'ARS';
  const rangeLabel = `Rango válido: $${fmtPrice(suggested)} – ${
    maximo != null ? `$${fmtPrice(maximo)}` : 'sin límite'
  } ${moneda}`;

  // History ASC from the backend -> render newest-first (copy before reverse).
  const history = [...(pujasQuery.data ?? [])].reverse();

  // Only an open, unsold lot accepts bids; the backend 400s otherwise.
  const isLive = !localClosed && detail?.status === 'live' && !detail?.vendido;

  const handleBid = () => {
    const val = Number(bidInput.replace(/\./g, ''));
    if (isNaN(val) || val <= 0) {
      setBidError('Ingresá un monto válido.');
      return;
    }
    if (val < suggested) {
      setBidError(`El mínimo es $${fmtPrice(suggested)} ${moneda}.`);
      return;
    }
    if (maximo != null && val > maximo) {
      setBidError(`El máximo es $${fmtPrice(maximo)} ${moneda}.`);
      return;
    }
    setBidError(null);
    router.push({
      pathname: '/bid-confirmation',
      params: {
        catalogoItemId: String(catalogoItemId),
        monto: String(val),
        title: detail?.title ?? '',
        moneda: detail?.moneda ?? 'ARS',
      },
    });
  };

  return (
    <Screen edges={['top']}>
      <GuestAccessModal
        visible={isGuest}
        message="Las salas en vivo requieren una cuenta. Registrate para participar."
        primaryAction={{ label: 'Iniciar sesión', onPress: () => router.replace('/(auth)/login') }}
        secondaryAction={{ label: 'Volver', onPress: () => router.back() }}
      />
      <ScreenHeader title="Sala en vivo" rightIcon="people-outline" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

            {isLive && timeLeft ? (
              <View style={[styles.timerRow, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
                <Icon name="timer-outline" size={16} color={theme.warning} />
                <ThemedText type="smallBold" style={{ color: theme.warning }}>
                  Cierra en {timeLeft}
                </ThemedText>
              </View>
            ) : null}

            <Card elevated style={styles.currentBid}>
              <ThemedText type="caption" themeColor="textSecondary">
                Oferta actual
              </ThemedText>
              <ThemedText type="price" style={styles.bigPrice}>
                ${fmtPrice(currentBid)} {moneda}
              </ThemedText>
            </Card>

            <Card style={styles.suggestCard}>
              <ThemedText type="caption" themeColor="textSecondary">
                Oferta sugerida (mínimo próxima)
              </ThemedText>
              <ThemedText type="heading" style={{ color: theme.primary }}>
                ${fmtPrice(suggested)} {moneda}
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
                          ${fmtPrice(num(puja.monto))} {moneda}
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
            <>
              <Input
                label="Tu oferta"
                keyboardType="numeric"
                value={bidInput}
                onChangeText={(t) => {
                  setBidInput(fmtMoneyInput(t));
                  setBidError(null);
                }}
                leading={<ThemedText type="small" themeColor="textSecondary">{moneda} $</ThemedText>}
                error={bidError ?? undefined}
              />
              <Button title="Pujar" fullWidth onPress={handleBid} />
            </>
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
      </KeyboardAvoidingView>
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
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
