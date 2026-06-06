import { ScrollView, StyleSheet, View } from 'react-native';

import { num } from '@/api/types';
import { useMetricasUsuario } from '@/api/hooks/useMetricas';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useSession } from '@/context/session';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function MetricsScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();
  const q = useMetricasUsuario(usuarioId);

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="title">Métricas</ThemedText>

        {usuarioId == null ? (
          <EmptyState
            icon="person-circle-outline"
            message="Iniciá sesión para ver tus métricas."
          />
        ) : q.isLoading ? (
          <LoadingState message="Cargando métricas…" />
        ) : q.isError ? (
          <ErrorState message="No pudimos cargar tus métricas." onRetry={q.refetch} />
        ) : q.data ? (
          <MetricsContent metricas={q.data} theme={theme} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function MetricsContent({
  metricas: m,
  theme,
}: {
  metricas: import('@/api/types').MetricasUsuario;
  theme: ReturnType<typeof useTheme>;
}) {
  const successRate = Math.round((m.subastas_ganadas / Math.max(1, m.subastas_asistidas)) * 100);

  const kpis: { icon: IconName; label: string; value: string }[] = [
    {
      icon: 'cash-outline',
      label: 'Total gastado',
      value: '$' + num(m.importe_pagado).toLocaleString('en-US'),
    },
    { icon: 'trophy-outline', label: 'Subastas ganadas', value: String(m.subastas_ganadas) },
    { icon: 'hammer-outline', label: 'Pujas', value: String(m.cantidad_pujas) },
    { icon: 'trending-up-outline', label: 'Tasa de éxito', value: successRate + '%' },
  ];

  const summary: { icon: IconName; label: string; value: string }[] = [
    {
      icon: 'pricetag-outline',
      label: 'Importe ofertado',
      value: '$' + num(m.importe_ofertado).toLocaleString('en-US'),
    },
    {
      icon: 'calendar-outline',
      label: 'Subastas asistidas',
      value: String(m.subastas_asistidas),
    },
  ];

  return (
    <>
      <View style={styles.grid}>
        {kpis.map((k) => (
          <Card key={k.label} elevated style={styles.kpi}>
            <View style={[styles.kpiIcon, { backgroundColor: theme.primaryGlow }]}>
              <Icon name={k.icon} size={18} color={theme.primary} />
            </View>
            <ThemedText type="subtitle">{k.value}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {k.label}
            </ThemedText>
          </Card>
        ))}
      </View>

      <Card style={styles.summaryCard}>
        <ThemedText type="heading">Resumen de actividad</ThemedText>
        {summary.map((s) => (
          <View key={s.label} style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.primaryGlow }]}>
              <Icon name={s.icon} size={16} color={theme.primary} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.summaryLabel}>
              {s.label}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.summaryValue}>
              {s.value}
            </ThemedText>
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.seven },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  kpi: { width: '47.5%', gap: Spacing.two },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { gap: Spacing.four },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: { flex: 1 },
  summaryValue: { fontWeight: '600' },
});
