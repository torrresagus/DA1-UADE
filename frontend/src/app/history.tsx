import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useBidHistoryVM } from '@/api/hooks/usePujas';
import { useVentasUsuario, usePagarVenta } from '@/api/hooks/useMultas';
import { num } from '@/api/types';
import type { VentaOut } from '@/api/types';
import { fmtPrice, parseUtcDate } from '@/utils/format';
import type { BidStatus } from '@/api/hooks/usePujas';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge, BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

const FILTERS = ['Todas', 'Ganadas', 'Perdidas', 'Activas'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_STATUS: Record<Filter, BidStatus | null> = {
  Todas: null,
  Ganadas: 'won',
  Perdidas: 'lost',
  Activas: 'active',
};

const META: Record<BidStatus, { label: string; tone: BadgeTone }> = {
  won: { label: 'Ganada', tone: 'success' },
  lost: { label: 'Perdida', tone: 'danger' },
  active: { label: 'Activa', tone: 'gold' },
};

/** Format an ISO timestamp as a short es-AR date; guard invalid values. */
function formatDate(iso: string): string {
  const date = parseUtcDate(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR');
}

function VentaPendienteCard({ venta, usuarioId }: { venta: VentaOut; usuarioId: number }) {
  const theme = useTheme();
  const pagar = usePagarVenta(usuarioId);
  const total = num(venta.monto_final) + num(venta.comision) + num(venta.costo_envio);

  return (
    <Card elevated style={styles.ventaCard}>
      <View style={styles.ventaHead}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Lote #{venta.catalogo_item_id}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Ganado el {formatDate(venta.fecha)}
          </ThemedText>
        </View>
        <Badge label={venta.pagada ? 'Pagada' : 'Pendiente'} tone={venta.pagada ? 'success' : 'gold'} />
      </View>

      <View style={styles.ventaRow}>
        <Icon name="pricetag-outline" size={15} color={theme.textSecondary} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.flex}>Oferta</ThemedText>
        <ThemedText type="small">${fmtPrice(num(venta.monto_final))} {venta.moneda}</ThemedText>
      </View>
      <View style={styles.ventaRow}>
        <Icon name="receipt-outline" size={15} color={theme.textSecondary} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.flex}>Comisión (10%)</ThemedText>
        <ThemedText type="small">${fmtPrice(num(venta.comision))} {venta.moneda}</ThemedText>
      </View>
      <View style={[styles.ventaRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: Spacing.two }]}>
        <Icon name="cash-outline" size={15} color={theme.primary} />
        <ThemedText type="smallBold" style={[styles.flex, { color: theme.primary }]}>Total a pagar</ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>${fmtPrice(total)} {venta.moneda}</ThemedText>
      </View>

      {!venta.pagada ? (
        <>
          {pagar.isError ? (
            <ThemedText type="caption" style={{ color: theme.danger }}>
              No se pudo registrar el pago. Intentá de nuevo.
            </ThemedText>
          ) : null}
          <Button
            title={pagar.isPending ? 'Procesando…' : 'Pagar compra'}
            fullWidth
            loading={pagar.isPending}
            onPress={() => pagar.mutate(venta.id)}
          />
        </>
      ) : null}
    </Card>
  );
}

export default function HistoryScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();
  const [filter, setFilter] = useState<Filter>('Todas');
  const q = useBidHistoryVM(usuarioId);
  const ventasQ = useVentasUsuario(usuarioId);

  if (usuarioId == null) {
    return (
      <Screen padded>
        <ScreenHeader title="Historial" />
        <EmptyState icon="person-outline" message="Iniciá sesión para ver tu historial." />
      </Screen>
    );
  }

  const wantStatus = FILTER_STATUS[filter];
  const rows = (q.data ?? []).filter((r) => (wantStatus ? r.status === wantStatus : true));
  const ventasPendientes = (ventasQ.data ?? []).filter((v) => !v.pagada);
  const ventasPagadas = (ventasQ.data ?? []).filter((v) => v.pagada);

  return (
    <Screen padded>
      <ScreenHeader title="Historial" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Compras pendientes ── */}
        {ventasPendientes.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="heading">Compras pendientes de pago</ThemedText>
            {ventasPendientes.map((v) => (
              <VentaPendienteCard key={v.id} venta={v} usuarioId={usuarioId!} />
            ))}
          </View>
        ) : null}

        {/* ── Historial de pujas ── */}
        <View style={styles.section}>
          <ThemedText type="heading">Pujas</ThemedText>
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>
          {q.isLoading ? (
            <LoadingState message="Cargando historial..." />
          ) : q.isError ? (
            <ErrorState message="No se pudo cargar tu historial." onRetry={q.refetch} />
          ) : rows.length === 0 ? (
            <EmptyState icon="file-tray-outline" message="No hay pujas para mostrar." />
          ) : (
            rows.map(({ puja, status }) => (
              <Card key={puja.id} style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    Lote #{puja.catalogo_item_id}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {formatDate(puja.fecha_hora)}
                  </ThemedText>
                </View>
                <View style={styles.right}>
                  <ThemedText type="price" style={styles.amount}>
                    ${fmtPrice(num(puja.monto))}
                  </ThemedText>
                  <Badge label={META[status].label} tone={META[status].tone} />
                </View>
              </Card>
            ))
          )}
        </View>

        {/* ── Compras pagadas ── */}
        {ventasPagadas.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="heading">Compras pagadas</ThemedText>
            {ventasPagadas.map((v) => (
              <VentaPendienteCard key={v.id} venta={v} usuarioId={usuarioId!} />
            ))}
          </View>
        ) : null}

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.three },
  content: { gap: Spacing.five, paddingBottom: Spacing.seven },
  section: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  right: { alignItems: 'flex-end', gap: Spacing.two },
  amount: { fontSize: 16, lineHeight: 20 },
  ventaCard: { gap: Spacing.two },
  ventaHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  ventaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
