import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useBidHistoryVM } from '@/api/hooks/usePujas';
import { num } from '@/api/types';
import type { BidStatus } from '@/api/hooks/usePujas';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge, BadgeTone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';

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
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR');
}

export default function HistoryScreen() {
  const { usuarioId } = useSession();
  const [filter, setFilter] = useState<Filter>('Todas');
  const q = useBidHistoryVM(usuarioId);

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

  return (
    <Screen padded>
      <ScreenHeader title="Historial" />
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {rows.map(({ puja, status }) => (
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
                  ${num(puja.monto).toLocaleString('en-US')}
                </ThemedText>
                <Badge label={META[status].label} tone={META[status].tone} />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.three },
  content: { gap: Spacing.three, paddingBottom: Spacing.seven },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  right: { alignItems: 'flex-end', gap: Spacing.two },
  amount: { fontSize: 16, lineHeight: 20 },
});
