import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useMisSolicitudes, useSolicitud } from '@/api/hooks/useSolicitudes';
import type { EstadoSolicitud, SolicitudOut } from '@/api/types';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x300?text=Producto';

type StepDef = { label: string; icon: IconName };

// Visual timeline. The terminal step relabels itself from the estado below.
const TIMELINE: StepDef[] = [
  { label: 'Producto recibido', icon: 'cube' },
  { label: 'En inspección', icon: 'search' },
  { label: 'Resolución', icon: 'checkmark-circle' },
  { label: 'Subasta programada', icon: 'calendar' },
];

// Ordering used to derive how far the timeline has progressed.
// terminal = aceptada | rechazada | devuelta (all map to step index 2).
function progressIndex(estado: EstadoSolicitud): number {
  switch (estado) {
    case 'ingresada':
      return 0;
    case 'en_inspeccion':
      return 1;
    case 'aceptada':
    case 'rechazada':
    case 'devuelta':
      return 2;
    default:
      return 0;
  }
}

const BADGE: Record<EstadoSolicitud, { label: string; tone: BadgeTone }> = {
  ingresada: { label: 'Ingresada', tone: 'neutral' },
  en_inspeccion: { label: 'En inspección', tone: 'gold' },
  aceptada: { label: 'Aceptada', tone: 'success' },
  rechazada: { label: 'Rechazada', tone: 'danger' },
  devuelta: { label: 'Devuelta', tone: 'neutral' },
};

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR');
}

export default function ProductStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuarioId } = useSession();
  const solicitudId = id != null && id !== '' ? Number(id) : null;
  const validId = solicitudId != null && Number.isFinite(solicitudId) ? solicitudId : null;
  const q = useSolicitud(validId);
  const list = useMisSolicitudes(usuarioId);

  // No concrete id -> list mode ("Mis productos"); otherwise the detail timeline.
  const isList = validId == null;
  let body: React.ReactNode;

  if (isList) {
    body =
      usuarioId == null ? (
        <EmptyState icon="person-outline" message="Iniciá sesión para ver tus productos." />
      ) : (
        <SolicitudList query={list} />
      );
  } else if (q.isLoading) {
    body = <LoadingState message="Cargando estado…" />;
  } else if (q.isError || !q.data) {
    body = (
      <ErrorState
        message={q.error instanceof Error ? q.error.message : 'No se pudo cargar la solicitud.'}
        onRetry={q.refetch}
      />
    );
  } else {
    body = <StatusBody solicitud={q.data} />;
  }

  return (
    <Screen padded>
      <ScreenHeader title={isList ? 'Mis productos' : 'Estado del producto'} />
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

function SolicitudList({ query }: { query: ReturnType<typeof useMisSolicitudes> }) {
  if (query.isLoading) return <LoadingState message="Cargando tus productos…" />;
  if (query.isError)
    return (
      <ErrorState message="No se pudieron cargar tus productos." onRetry={query.refetch} />
    );

  const items = query.data ?? [];
  if (items.length === 0)
    return <EmptyState icon="cube-outline" message="No cargaste productos todavía." />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {items.map((s) => {
        const badge = BADGE[s.estado] ?? BADGE.ingresada;
        return (
          <Card
            key={s.id}
            onPress={() =>
              router.push({ pathname: '/product-status', params: { id: String(s.id) } })
            }
            style={styles.listRow}>
            <Image source={{ uri: s.imagenes[0]?.url ?? PLACEHOLDER_IMAGE }} style={styles.listThumb} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {(s.descripcion ?? '').slice(0, 50) || 'Sin descripción'}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {shortDate(s.fecha)}
              </ThemedText>
            </View>
            <Badge label={badge.label} tone={badge.tone} />
          </Card>
        );
      })}
    </ScrollView>
  );
}

function StatusBody({ solicitud }: { solicitud: SolicitudOut }) {
  const theme = useTheme();

  const title = (solicitud.descripcion ?? '').slice(0, 60) || 'Sin descripción';
  const imageUri = solicitud.imagenes[0]?.url ?? PLACEHOLDER_IMAGE;
  const badge = BADGE[solicitud.estado] ?? BADGE.ingresada;
  const current = progressIndex(solicitud.estado);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Card elevated style={styles.product}>
        <Image source={{ uri: imageUri }} style={styles.thumb} />
        <View style={styles.flex}>
          <ThemedText type="heading">{title}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Enviado el {shortDate(solicitud.fecha)}
          </ThemedText>
          <Badge label={badge.label} tone={badge.tone} style={styles.badge} />
          {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo ? (
            <ThemedText type="caption" style={{ color: theme.danger, marginTop: Spacing.two }}>
              {solicitud.motivo_rechazo}
            </ThemedText>
          ) : null}
        </View>
      </Card>

      <Card style={styles.timelineCard}>
        <ThemedText type="heading">Progreso</ThemedText>
        <View style={styles.timeline}>
          {TIMELINE.map((s, i) => {
            const done = i <= current;
            // Relabel the terminal step to reflect the actual resolution.
            const label =
              i === 2 && (solicitud.estado === 'rechazada' || solicitud.estado === 'devuelta')
                ? badge.label
                : s.label;
            return (
              <View key={s.label} style={styles.step}>
                <View style={styles.stepIconCol}>
                  <View
                    style={[
                      styles.stepIcon,
                      {
                        backgroundColor: done ? theme.primary : theme.cardElevated,
                        borderColor: done ? theme.primary : theme.border,
                      },
                    ]}>
                    <Icon
                      name={done ? 'checkmark' : s.icon}
                      size={16}
                      color={done ? theme.onPrimary : theme.textSecondary}
                    />
                  </View>
                  {i < TIMELINE.length - 1 ? (
                    <View
                      style={[
                        styles.connector,
                        { backgroundColor: done ? theme.primary : theme.border },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={styles.stepBody}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: done ? theme.text : theme.textSecondary }}>
                    {label}
                  </ThemedText>
                  {done ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      Completado
                    </ThemedText>
                  ) : (
                    <ThemedText type="caption" themeColor="textMuted">
                      Pendiente
                    </ThemedText>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.four, paddingVertical: Spacing.four, paddingBottom: Spacing.six },
  product: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: Radius.md },
  badge: { marginTop: Spacing.two },
  timelineCard: { gap: Spacing.four },
  timeline: { gap: 0 },
  step: { flexDirection: 'row', gap: Spacing.three },
  stepIconCol: { alignItems: 'center' },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: { width: 2, flex: 1, minHeight: 24, marginVertical: 4 },
  stepBody: { paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: 2 },
  cta: { marginBottom: Spacing.four },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  listThumb: { width: 48, height: 48, borderRadius: Radius.sm, backgroundColor: '#0E121A' },
});
