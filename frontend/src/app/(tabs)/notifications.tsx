import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { num } from '@/api/types';
import { fmtPrice, parseUtcDate } from '@/utils/format';
import type { MultaOut, NotificacionOut } from '@/api/types';
import { useMultasUsuario, usePagarMulta } from '@/api/hooks/useMultas';
import { useEliminarNotificaciones, useMarcarLeida, useNotificaciones } from '@/api/hooks/useNotificaciones';
import { getNotifPrefs, type NotifPrefs } from '@/utils/notifPrefs';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Icon, IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function NotificationsScreen() {
  const { usuarioId } = useSession();
  const multas = useMultasUsuario(usuarioId);
  const notis = useNotificaciones(usuarioId);
  const eliminar = useEliminarNotificaciones(usuarioId ?? 0);
  const [prefs, setPrefs] = useState<NotifPrefs>({
    ventas: true,
    multas: true,
    solicitudes: true,
    medios_pago: true,
  });

  useEffect(() => {
    getNotifPrefs().then(setPrefs);
  }, []);

  const hasNotifs = (notis.data?.length ?? 0) > 0;

  const head = (
    <View style={styles.head}>
      <ThemedText type="title">Notificaciones</ThemedText>
      {hasNotifs ? (
        <Button
          title={eliminar.isPending ? '…' : 'Eliminar todas'}
          variant="ghost"
          size="sm"
          onPress={() => eliminar.mutate()}
          disabled={eliminar.isPending}
        />
      ) : null}
    </View>
  );

  if (usuarioId == null) {
    return (
      <Screen edges={['top']}>
        <View style={styles.content}>
          {head}
          <EmptyState icon="notifications-outline" message="Iniciá sesión para ver tus notificaciones" />
        </View>
      </Screen>
    );
  }

  if (multas.isLoading) {
    return (
      <Screen edges={['top']}>
        <View style={styles.content}>
          {head}
          <LoadingState />
        </View>
      </Screen>
    );
  }

  if (multas.isError) {
    return (
      <Screen edges={['top']}>
        <View style={styles.content}>
          {head}
          <ErrorState message="No pudimos cargar tus notificaciones." onRetry={multas.refetch} />
        </View>
      </Screen>
    );
  }

  const impagas = prefs.multas ? (multas.data ?? []).filter((m) => !m.pagada) : [];
  const mensajes = (notis.data ?? []).filter((n) => {
    const tipo = n.tipo as keyof NotifPrefs;
    return prefs[tipo] !== false;
  });
  const isEmpty = impagas.length === 0 && mensajes.length === 0;

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {head}

        {isEmpty ? (
          <EmptyState icon="notifications-outline" message="No tenés notificaciones por ahora" />
        ) : (
          <>
            {impagas.map((m) => (
              <MultaCard key={`multa-${m.id}`} multa={m} usuarioId={usuarioId as number} />
            ))}
            {mensajes.map((n) => (
              <NotifCard key={`noti-${n.id}`} noti={n} usuarioId={usuarioId as number} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const TIPO_ICON: Record<string, IconName> = {
  venta: 'trophy',
  multa: 'card',
  solicitud: 'cube',
};

function NotifCard({ noti, usuarioId }: { noti: NotificacionOut; usuarioId: number }) {
  const theme = useTheme();
  const marcar = useMarcarLeida(usuarioId);
  const isVenta = noti.tipo === 'venta';

  const handlePress = () => {
    if (!noti.leida) marcar.mutate(noti.id);
    if (isVenta) router.push('/history');
  };

  return (
    <Card elevated onPress={handlePress} style={isVenta ? styles.card : styles.row}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.cardElevated }]}>
          <Icon name={TIPO_ICON[noti.tipo] ?? 'notifications'} size={18} color={theme.primary} />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
              {noti.titulo}
            </ThemedText>
            {!noti.leida ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {noti.cuerpo}
          </ThemedText>
        </View>
      </View>
      {isVenta ? (
        <Button
          title="Ir a Historial para pagar"
          fullWidth
          size="sm"
          onPress={() => {
            if (!noti.leida) marcar.mutate(noti.id);
            router.push('/history');
          }}
        />
      ) : null}
    </Card>
  );
}

function MultaCard({ multa, usuarioId }: { multa: MultaOut; usuarioId: number }) {
  const theme = useTheme();
  const pagar = usePagarMulta(usuarioId);

  const vencimiento = multa.fecha_vencimiento
    ? parseUtcDate(multa.fecha_vencimiento).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Card elevated style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.cardElevated }]}>
          <Icon name="card" size={18} color={theme.danger} />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
              Tenés una multa impaga
            </ThemedText>
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {multa.motivo} — ${fmtPrice(num(multa.monto))}
          </ThemedText>
          {vencimiento ? (
            <ThemedText type="caption" style={{ color: theme.warning }}>
              Vence el {vencimiento} (72hs para presentar los fondos)
            </ThemedText>
          ) : null}
        </View>
      </View>
      <Button
        title={pagar.isPending ? 'Pagando…' : `Pagar multa $${fmtPrice(num(multa.monto))}`}
        fullWidth
        size="sm"
        disabled={pagar.isPending}
        onPress={() => pagar.mutate(multa.id)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.seven },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.one },
  card: { gap: Spacing.three, padding: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
