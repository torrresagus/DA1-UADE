import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { commissionPreview } from '@/api/adapters';
import { ApiError } from '@/api/client';
import { useCrearPuja } from '@/api/hooks/usePujas';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function BidConfirmationScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();
  const { catalogoItemId, monto, title } = useLocalSearchParams<{
    catalogoItemId: string;
    monto: string;
    title?: string;
  }>();
  const montoN = Number(monto);
  const m = useCrearPuja();
  const [error, setError] = useState<string | null>(null);

  const { puja, comision, total } = commissionPreview(montoN);
  const summary = [
    { label: 'Tu oferta de puja', value: `$${puja.toLocaleString('en-US')}` },
    { label: 'Comisión del Comprador (10%)', value: `$${comision.toLocaleString('en-US')}` },
    { label: 'Total estimado', value: `$${total.toLocaleString('en-US')}`, total: true },
  ];

  const onConfirm = async () => {
    if (usuarioId == null) {
      setError('Iniciá sesión para confirmar tu puja.');
      return;
    }
    setError(null);
    try {
      await m.mutateAsync({
        catalogo_item_id: Number(catalogoItemId),
        usuario_id: usuarioId,
        monto: montoN,
      });
      router.replace({
        pathname: '/result',
        params: { title: title ?? '', monto: String(montoN), status: 'confirmed' },
      });
    } catch (err) {
      // Stay on the sheet and surface the backend rule message verbatim.
      setError(err instanceof ApiError ? err.detail : 'Ocurrió un error');
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(18)}
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
            disabled={m.isPending}
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
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
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
  actions: { width: '100%', gap: Spacing.two, marginTop: Spacing.two },
});
