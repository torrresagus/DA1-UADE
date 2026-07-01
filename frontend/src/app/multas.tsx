import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useMultasUsuario, usePagarMulta } from '@/api/hooks/useMultas';
import type { MultaOut } from '@/api/types';
import { num } from '@/api/types';
import { fmtPrice } from '@/utils/format';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

function multaStatus(m: MultaOut): { label: string; tone: BadgeTone } {
  if (m.derivada_justicia) return { label: 'Derivada a justicia', tone: 'danger' };
  if (m.pagada) return { label: 'Pagada', tone: 'success' };
  if (m.fecha_vencimiento && new Date(m.fecha_vencimiento) < new Date()) {
    return { label: 'Vencida', tone: 'danger' };
  }
  return { label: 'Pendiente', tone: 'gold' };
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR');
}

function MultaCard({ multa, usuarioId }: { multa: MultaOut; usuarioId: number }) {
  const theme = useTheme();
  const pagar = usePagarMulta(usuarioId);
  const { label, tone } = multaStatus(multa);
  const canPay = !multa.pagada && !multa.derivada_justicia;

  return (
    <Card elevated style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{multa.motivo}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Generada el {shortDate(multa.fecha)}
          </ThemedText>
        </View>
        <Badge label={label} tone={tone} />
      </View>

      <View style={styles.row}>
        <Icon name="cash-outline" size={16} color={theme.danger} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          Importe
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.danger }}>
          ${fmtPrice(num(multa.monto))} {multa.moneda}
        </ThemedText>
      </View>

      {multa.fecha_vencimiento ? (
        <View style={styles.row}>
          <Icon name="time-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Vence el
          </ThemedText>
          <ThemedText type="small">{shortDate(multa.fecha_vencimiento)}</ThemedText>
        </View>
      ) : null}

      {multa.derivada_justicia ? (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          Este caso fue derivado a la justicia. Tu acceso a la plataforma fue suspendido.
        </ThemedText>
      ) : null}

      {canPay ? (
        <View style={styles.actions}>
          {pagar.isError ? (
            <ThemedText type="caption" style={{ color: theme.danger }}>
              No se pudo registrar el pago. Intentá de nuevo.
            </ThemedText>
          ) : null}
          <Button
            title={pagar.isPending ? 'Procesando…' : 'Pagar multa'}
            fullWidth
            loading={pagar.isPending}
            onPress={() => pagar.mutate(multa.id)}
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function MultasScreen() {
  const { usuarioId } = useSession();
  const q = useMultasUsuario(usuarioId);

  let body: React.ReactNode;

  if (usuarioId == null) {
    body = <EmptyState icon="person-outline" message="Iniciá sesión para ver tus multas." />;
  } else if (q.isLoading) {
    body = <LoadingState message="Cargando multas…" />;
  } else if (q.isError) {
    body = (
      <ErrorState message="No se pudieron cargar las multas." onRetry={q.refetch} />
    );
  } else if (!q.data || q.data.length === 0) {
    body = (
      <EmptyState
        icon="checkmark-circle-outline"
        message="No tenés multas registradas. ¡Seguí así!"
      />
    );
  } else {
    const pendientes = q.data.filter((m) => !m.pagada && !m.derivada_justicia);
    const resto = q.data.filter((m) => m.pagada || m.derivada_justicia);
    body = (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {pendientes.length > 0 ? (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Pendientes ({pendientes.length})
            </ThemedText>
            {pendientes.map((m) => (
              <MultaCard key={m.id} multa={m} usuarioId={usuarioId} />
            ))}
          </>
        ) : null}
        {resto.length > 0 ? (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
              Historial
            </ThemedText>
            {resto.map((m) => (
              <MultaCard key={m.id} multa={m} usuarioId={usuarioId} />
            ))}
          </>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <Screen padded>
      <ScreenHeader title="Mis multas" />
      {body}
      <Button
        title="Volver al perfil"
        variant="ghost"
        fullWidth
        style={styles.cta}
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingVertical: Spacing.four, paddingBottom: Spacing.six },
  card: { gap: Spacing.three },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.one },
  cta: { marginBottom: Spacing.four },
});
