import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useMisSolicitudes, useResponderSolicitud, useSolicitud } from '@/api/hooks/useSolicitudes';
import { useDepositoInspeccion } from '@/api/hooks/useEmpresaInfo';
import type { CategoriaUsuario, EstadoSolicitud, SolicitudOut } from '@/api/types';
import { num } from '@/api/types';
import { fmtPrice } from '@/utils/format';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
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
    case 'rechazada_por_usuario':
      return 2;
    case 'confirmada_por_usuario':
      return 3;
    default:
      return 0;
  }
}

const BADGE: Record<EstadoSolicitud, { label: string; tone: BadgeTone }> = {
  ingresada: { label: 'En revisión', tone: 'neutral' },
  en_inspeccion: { label: 'En inspección', tone: 'gold' },
  aceptada: { label: 'Propuesta recibida', tone: 'gold' },
  rechazada: { label: 'No aceptada', tone: 'danger' },
  confirmada_por_usuario: { label: 'Incluido en subasta', tone: 'success' },
  rechazada_por_usuario: { label: 'Rechazada por vos', tone: 'neutral' },
  devuelta: { label: 'Devuelta', tone: 'neutral' },
};

const ESTADO_DESC: Record<EstadoSolicitud, string> = {
  ingresada: 'Tu bien está esperando ser inspeccionado',
  en_inspeccion: 'El equipo de Bidify está revisando tu bien',
  aceptada: 'La empresa hizo una propuesta · revisá y respondé',
  rechazada: 'Tu bien no fue aceptado · se procede a la devolución',
  confirmada_por_usuario: 'Tu bien ya está programado en una subasta',
  rechazada_por_usuario: 'Rechazaste la propuesta · el bien se devuelve',
  devuelta: 'El bien fue devuelto con los cargos correspondientes',
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
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                {ESTADO_DESC[s.estado] ?? shortDate(s.fecha)}
              </ThemedText>
            </View>
            <Badge label={badge.label} tone={badge.tone} />
          </Card>
        );
      })}
    </ScrollView>
  );
}

const CATEGORIAS: { value: CategoriaUsuario; label: string }[] = [
  { value: 'comun', label: 'General' },
  { value: 'especial', label: 'Especial' },
  { value: 'plata', label: 'Plata' },
  { value: 'oro', label: 'Oro' },
  { value: 'platino', label: 'Platino' },
];

function StatusBody({ solicitud }: { solicitud: SolicitudOut }) {
  const theme = useTheme();
  const responder = useResponderSolicitud(solicitud.id);
  const deposito = useDepositoInspeccion();
  const [selectedCategoria, setSelectedCategoria] = useState<CategoriaUsuario>('comun');
  const [iniciarInmediatamente, setIniciarInmediatamente] = useState(false);

  const title = (solicitud.descripcion ?? '').slice(0, 60) || 'Sin descripción';
  const imageUri = solicitud.imagenes[0]?.url ?? PLACEHOLDER_IMAGE;
  const badge = BADGE[solicitud.estado] ?? BADGE.ingresada;
  const current = progressIndex(solicitud.estado);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {solicitud.estado === 'confirmada_por_usuario' ? (
        <Card elevated style={styles.proposal}>
          <View style={[styles.confirmedHeader, { borderBottomColor: theme.border }]}>
            <Icon name="checkmark-circle" size={24} color={theme.success} />
            <ThemedText type="heading">Incluido en subasta</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Aceptaste las condiciones. Tu bien fue ingresado al sistema y aparece publicado en
            el inicio de la app.
          </ThemedText>

          <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
            Datos del bien
          </ThemedText>
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">Número de pieza</ThemedText>
            <ThemedText type="smallBold">{solicitud.articulo_nro_pieza ?? '—'}</ThemedText>
          </View>
          {solicitud.precio_base_propuesto != null ? (
            <View style={styles.proposalRow}>
              <ThemedText type="small" themeColor="textSecondary">Valor base</ThemedText>
              <ThemedText type="smallBold">
                ${fmtPrice(num(solicitud.precio_base_propuesto))}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">Fecha de subasta</ThemedText>
            <ThemedText type="smallBold">{shortDate(solicitud.fecha_subasta_propuesta)}</ThemedText>
          </View>
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">Ubicación</ThemedText>
            <ThemedText type="smallBold">{solicitud.ubicacion_subasta ?? 'Bidify - Online'}</ThemedText>
          </View>

          <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
            Seguro del bien
          </ThemedText>
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">Póliza</ThemedText>
            <ThemedText type="smallBold">{solicitud.nro_poliza ?? '—'}</ThemedText>
          </View>
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">Compañía</ThemedText>
            <ThemedText type="smallBold">Bidify Seguros S.A.</ThemedText>
          </View>

          <Button
            title="Ver subastas activas"
            variant="ghost"
            fullWidth
            style={{ marginTop: Spacing.two }}
            onPress={() => router.replace('/(tabs)/home')}
          />
        </Card>
      ) : null}

      {solicitud.estado === 'en_inspeccion' ? (
        <Card elevated style={styles.proposal}>
          <View style={[styles.confirmedHeader, { borderBottomColor: theme.border }]}>
            <Icon name="cube-outline" size={24} color={theme.primary} />
            <ThemedText type="heading">Enviá tu bien para inspección</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            La empresa está revisando tu solicitud. Si desean inspeccionarlo físicamente,
            enviá el bien a la siguiente dirección:
          </ThemedText>
          {deposito.data ? (
            <View style={[styles.infoSection, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
              <View style={styles.proposalRow}>
                <Icon name="business-outline" size={16} color={theme.primary} />
                <ThemedText type="smallBold" style={styles.flex}>{deposito.data.nombre}</ThemedText>
              </View>
              <View style={styles.proposalRow}>
                <Icon name="location-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {deposito.data.direccion}
                </ThemedText>
              </View>
              <View style={styles.proposalRow}>
                <Icon name="map-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {deposito.data.ciudad}
                </ThemedText>
              </View>
            </View>
          ) : null}
          <ThemedText type="caption" themeColor="textMuted">
            Recordá que en caso de no ser aceptado, el bien te será devuelto con los gastos a
            tu cargo.
          </ThemedText>
        </Card>
      ) : null}

      {solicitud.estado === 'aceptada' ? (
        <Card elevated style={styles.proposal}>
          <ThemedText type="heading">La empresa aceptó tu bien</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Revisá las condiciones propuestas y confirmá si estás de acuerdo.
          </ThemedText>
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Valor base
            </ThemedText>
            <ThemedText type="smallBold">
              {solicitud.precio_base_propuesto != null
                ? `$${fmtPrice(num(solicitud.precio_base_propuesto))}`
                : '—'}
            </ThemedText>
          </View>
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Comisión
            </ThemedText>
            <ThemedText type="smallBold">
              {solicitud.comision_propuesta != null
                ? `$${fmtPrice(num(solicitud.comision_propuesta))}`
                : '—'}
            </ThemedText>
          </View>
          <View style={styles.proposalRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Fecha de subasta
            </ThemedText>
            <ThemedText type="smallBold">{shortDate(solicitud.fecha_subasta_propuesta)}</ThemedText>
          </View>

          <View style={[styles.infoSection, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
            <ThemedText type="smallBold">Si aceptás, tu bien recibirá:</ThemedText>
            <View style={styles.proposalRow}>
              <ThemedText type="small" themeColor="textSecondary">Póliza de seguro</ThemedText>
              <ThemedText type="smallBold">POL-SOL-{solicitud.id}</ThemedText>
            </View>
            <View style={styles.proposalRow}>
              <ThemedText type="small" themeColor="textSecondary">Asegurado por</ThemedText>
              <ThemedText type="smallBold">Bidify Seguros S.A.</ThemedText>
            </View>
            <View style={styles.proposalRow}>
              <ThemedText type="small" themeColor="textSecondary">Ubicación</ThemedText>
              <ThemedText type="smallBold">Bidify - Online</ThemedText>
            </View>
            <View style={styles.proposalRow}>
              <ThemedText type="small" themeColor="textSecondary">Nº de pieza</ThemedText>
              <ThemedText type="smallBold">SOL-{solicitud.id}</ThemedText>
            </View>
          </View>

          <View style={styles.categoriaSection}>
            <ThemedText type="small" themeColor="textSecondary">
              ¿Para qué categoría querés que sea la subasta?
            </ThemedText>
            <View style={styles.categoriaChips}>
              {CATEGORIAS.map((c) => (
                <Chip
                  key={c.value}
                  label={c.label}
                  active={selectedCategoria === c.value}
                  onPress={() => setSelectedCategoria(c.value)}
                />
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => setIniciarInmediatamente((v) => !v)}
            style={styles.checkRow}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: iniciarInmediatamente ? theme.primary : 'transparent',
                  borderColor: iniciarInmediatamente ? theme.primary : theme.borderStrong,
                },
              ]}>
              {iniciarInmediatamente ? <Icon name="checkmark" size={12} color={theme.onPrimary} /> : null}
            </View>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Iniciar subasta inmediatamente</ThemedText>
              <ThemedText type="caption" themeColor="textMuted">
                La subasta quedará activa al instante en lugar de esperar la fecha programada.
              </ThemedText>
            </View>
          </Pressable>

          {responder.isError ? (
            <ThemedText type="caption" style={{ color: theme.danger }}>
              No se pudo registrar tu respuesta. Probá de nuevo.
            </ThemedText>
          ) : null}
          <View style={styles.proposalActions}>
            <Button
              title="Aceptar"
              fullWidth
              loading={responder.isPending}
              onPress={() => responder.mutate({ acepta: true, categoria_minima: selectedCategoria, iniciar_inmediatamente: iniciarInmediatamente })}
            />
            <Button
              title="Rechazar"
              variant="ghost"
              fullWidth
              disabled={responder.isPending}
              onPress={() => responder.mutate({ acepta: false })}
            />
          </View>
          <ThemedText type="caption" themeColor="textMuted">
            Si rechazás, se procede a la devolución del bien informando los gastos.
          </ThemedText>
        </Card>
      ) : null}

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
  proposal: { gap: Spacing.three },
  confirmedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.two, borderBottomWidth: 1 },
  infoSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  proposalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proposalActions: { gap: Spacing.two, marginTop: Spacing.two },
  categoriaSection: { gap: Spacing.two },
  categoriaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
