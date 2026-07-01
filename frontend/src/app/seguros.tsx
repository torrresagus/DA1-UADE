import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useArticulo, useAumentarSeguro, useDeposito, useSeguros } from '@/api/hooks/useSeguros';
import { num } from '@/api/types';
import { fmtMoneyInput, fmtPrice } from '@/utils/format';
import type { SeguroOut } from '@/api/types';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function SegurosScreen() {
  const { usuarioId } = useSession();
  const q = useSeguros(usuarioId);

  let body: React.ReactNode;
  if (usuarioId == null) {
    body = <EmptyState icon="person-outline" message="Iniciá sesión para ver tus pólizas." />;
  } else if (q.isLoading) {
    body = <LoadingState message="Cargando pólizas…" />;
  } else if (q.isError) {
    body = <ErrorState message="No pudimos cargar tus seguros." onRetry={q.refetch} />;
  } else if (!q.data || q.data.length === 0) {
    body = <EmptyState icon="shield-outline" message="No tenés piezas aseguradas todavía." />;
  } else {
    body = (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {q.data.map((s) => (
          <SeguroCard key={s.id} seguro={s} usuarioId={usuarioId} />
        ))}
      </ScrollView>
    );
  }

  return (
    <Screen padded>
      <ScreenHeader title="Seguros y depósitos" />
      {body}
    </Screen>
  );
}

function SeguroCard({ seguro, usuarioId }: { seguro: SeguroOut; usuarioId: number }) {
  const theme = useTheme();
  const firstArticuloId = seguro.articulo_ids?.[0] ?? null;
  const { data: articulo } = useArticulo(firstArticuloId);
  const { data: deposito } = useDeposito(articulo?.deposito_id ?? null);
  const aumentar = useAumentarSeguro(usuarioId);

  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState('');

  const nuevoMonto = Number(monto.replace(/\./g, ''));
  const canConfirm =
    Number.isFinite(nuevoMonto) && nuevoMonto > num(seguro.monto_cubierto) && !aumentar.isPending;

  const confirm = async () => {
    if (!canConfirm) return;
    try {
      await aumentar.mutateAsync({ seguroId: seguro.id, nuevoMonto });
      setOpen(false);
      setMonto('');
    } catch {
      // el error se refleja en aumentar.isError abajo
    }
  };

  return (
    <Card elevated style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <ThemedText type="heading">Póliza {seguro.nro_poliza}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {seguro.compania}
          </ThemedText>
        </View>
        <Badge
          label={seguro.vigente === false ? 'No vigente' : 'Vigente'}
          tone={seguro.vigente === false ? 'danger' : 'success'}
        />
      </View>

      <View style={styles.row}>
        <Icon name="cash-outline" size={18} color={theme.primary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          Monto cubierto
        </ThemedText>
        <ThemedText type="smallBold">
          ${fmtPrice(num(seguro.monto_cubierto))} {seguro.moneda}
        </ThemedText>
      </View>

      {articulo ? (
        <View style={styles.row}>
          <Icon name="cube-outline" size={18} color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Pieza
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.value}>
            {articulo.numero_pieza}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.location}>
        <Icon name="location-outline" size={18} color={theme.primary} />
        <View style={styles.flex}>
          <ThemedText type="caption" themeColor="textSecondary">
            Ubicación
          </ThemedText>
          {deposito ? (
            <ThemedText type="small">
              {deposito.nombre} — {deposito.direccion}, {deposito.ciudad}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textMuted">
              Sin depósito asignado
            </ThemedText>
          )}
        </View>
      </View>

      {seguro.vigente !== false ? (
        <Button title="Aumentar cobertura" variant="ghost" fullWidth onPress={() => setOpen(true)} />
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="heading">Aumentar cobertura</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Cobertura actual: ${fmtPrice(num(seguro.monto_cubierto))}. Ingresá el
              nuevo monto (pagás la diferencia del premio).
            </ThemedText>
            <Input
              label="Nuevo monto"
              placeholder="0"
              keyboardType="numeric"
              value={monto}
              onChangeText={(t) => setMonto(fmtMoneyInput(t))}
            />
            {aumentar.isError ? (
              <ThemedText type="caption" style={{ color: theme.danger }}>
                No se pudo aumentar la póliza. Revisá el monto.
              </ThemedText>
            ) : null}
            <Button
              title={aumentar.isPending ? 'Confirmando…' : 'Confirmar'}
              fullWidth
              disabled={!canConfirm}
              onPress={confirm}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.four, paddingVertical: Spacing.four, paddingBottom: Spacing.six },
  card: { gap: Spacing.three },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  value: { maxWidth: '50%' },
  location: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: Spacing.five },
  sheet: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.five, gap: Spacing.three },
});
