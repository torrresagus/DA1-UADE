import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { commissionPreview } from '@/api/adapters';
import { ApiError } from '@/api/client';
import { useMediosPago } from '@/api/hooks/useMediosPago';
import { useCrearPuja } from '@/api/hooks/usePujas';
import type { MedioPagoOut } from '@/api/types';
import { fmtPrice } from '@/utils/format';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon, IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

function mpTypeIcon(tipo: MedioPagoOut['tipo']): IconName {
  if (tipo === 'tarjeta_credito') return 'card';
  if (tipo === 'cuenta_bancaria') return 'business';
  return 'document-text';
}

function mpLabel(m: MedioPagoOut): string {
  if (m.tipo === 'tarjeta_credito') return `Tarjeta · ${m.detalle}`;
  if (m.tipo === 'cuenta_bancaria') return `Cuenta · ${m.detalle}`;
  return `Cheque · ${m.detalle}`;
}

export default function BidConfirmationScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();
  const { catalogoItemId, monto, title, moneda } = useLocalSearchParams<{
    catalogoItemId: string;
    monto: string;
    title?: string;
    moneda?: string;
  }>();
  const auctionMoneda = moneda === 'USD' ? 'USD' : 'ARS';
  const montoN = Number(monto);
  const m = useCrearPuja();
  const [error, setError] = useState<string | null>(null);
  const [selectedMpId, setSelectedMpId] = useState<number | null>(null);
  const [retiraPersonalmente, setRetiraPersonalmente] = useState(false);

  const { data: mediosPago } = useMediosPago(usuarioId);
  // For USD auctions keep only methods whose moneda is USD or null (currency-agnostic).
  // For ARS auctions keep methods whose moneda is ARS or null.
  const verifiedMedios = (mediosPago ?? []).filter(
    (mp) => mp.verificado && (mp.moneda === auctionMoneda || mp.moneda == null),
  );

  // Auto-select if there is exactly one verified method.
  useEffect(() => {
    if (verifiedMedios.length === 1) {
      setSelectedMpId((prev) => prev ?? verifiedMedios[0].id);
    }
  }, [verifiedMedios.length]);

  const { puja, comision, total } = commissionPreview(montoN);
  const summary = [
    { label: 'Tu oferta de puja', value: `$${fmtPrice(puja)}` },
    { label: 'Comisión del Comprador (10%)', value: `$${fmtPrice(comision)}` },
    { label: 'Total estimado', value: `$${fmtPrice(total)}`, total: true },
  ];

  const onConfirm = async () => {
    if (usuarioId == null) {
      setError('Iniciá sesión para confirmar tu puja.');
      return;
    }
    if (selectedMpId == null) {
      setError('Seleccioná un método de pago antes de confirmar.');
      return;
    }
    setError(null);
    try {
      await m.mutateAsync({
        catalogo_item_id: Number(catalogoItemId),
        usuario_id: usuarioId,
        monto: montoN,
        retira_personalmente: retiraPersonalmente,
      });
      router.replace({
        pathname: '/result',
        params: { title: title ?? '', monto: String(montoN), status: 'confirmed' },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Ocurrió un error');
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(320)}
        style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />

        <View style={[styles.iconWrap, { backgroundColor: theme.primaryGlow }]}>
          <Icon name="hammer" size={28} color={theme.primary} />
        </View>

        <ThemedText type="subtitle" style={styles.center}>
          Confirmar puja
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {title ? `Estás a punto de pujar por ${title}.` : 'Estás a punto de confirmar tu puja.'}
        </ThemedText>

        <View style={[styles.summary, { borderColor: theme.border }]}>
          {summary.map((s, i) => (
            <View
              key={s.label}
              style={[styles.sumRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
              <ThemedText
                type={s.total ? 'smallBold' : 'small'}
                themeColor={s.total ? undefined : 'textSecondary'}>
                {s.label}
              </ThemedText>
              <ThemedText type={s.total ? 'price' : 'smallBold'} style={s.total && { fontSize: 18 }}>
                {s.value}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Selector de método de pago */}
        <View style={styles.mpSection}>
          <ThemedText type="caption" themeColor="textSecondary">
            Método de pago
          </ThemedText>
          {verifiedMedios.length === 0 ? (
            <Pressable onPress={() => router.replace('/payments')}>
              <ThemedText type="small" style={{ color: theme.warning }}>
                {auctionMoneda === 'USD'
                  ? 'No tenés métodos verificados en USD. Agregá uno →'
                  : 'No tenés métodos verificados. Agregá uno →'}
              </ThemedText>
            </Pressable>
          ) : (
            verifiedMedios.map((mp) => {
              const selected = selectedMpId === mp.id;
              return (
                <Pressable
                  key={mp.id}
                  onPress={() => {
                    setSelectedMpId(mp.id);
                    setError(null);
                  }}
                  style={[
                    styles.mpRow,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.primaryGlow : theme.cardElevated,
                    },
                  ]}>
                  <Icon
                    name={mpTypeIcon(mp.tipo)}
                    size={16}
                    color={selected ? theme.primary : theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={{ flex: 1, color: selected ? theme.primary : theme.text }}>
                    {mpLabel(mp)}
                  </ThemedText>
                  {selected && <Icon name="checkmark-circle" size={16} color={theme.primary} />}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Retiro personal */}
        <Pressable
          style={[styles.checkRow, { borderColor: theme.border, backgroundColor: theme.cardElevated }]}
          onPress={() => setRetiraPersonalmente((v) => !v)}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: retiraPersonalmente ? theme.primary : theme.border,
                backgroundColor: retiraPersonalmente ? theme.primary : 'transparent',
              },
            ]}>
            {retiraPersonalmente && <Icon name="checkmark" size={12} color="#fff" />}
          </View>
          <ThemedText type="small" style={{ flex: 1 }}>
            Retiro personalmente el bien
          </ThemedText>
        </Pressable>
        {retiraPersonalmente && (
          <ThemedText type="small" style={[styles.center, { color: theme.warning }]}>
            Al retirar personalmente perdés la cobertura del seguro sobre el bien.
          </ThemedText>
        )}

        {error ? (
          <ThemedText type="small" style={[styles.center, { color: theme.danger }]}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="Confirmar puja"
            fullWidth
            loading={m.isPending}
            disabled={m.isPending || selectedMpId == null}
            onPress={onConfirm}
          />
          <Button
            title="Cancelar"
            variant="ghost"
            fullWidth
            disabled={m.isPending}
            onPress={() => router.back()}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.three,
    alignItems: 'center',
  },
  handle: { width: 44, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  summary: { width: '100%', borderWidth: 1, borderRadius: Radius.md, marginTop: Spacing.two },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  mpSection: { width: '100%', gap: Spacing.two },
  mpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  actions: { width: '100%', gap: Spacing.two, marginTop: Spacing.two },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
