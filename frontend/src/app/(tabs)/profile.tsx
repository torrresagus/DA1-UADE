import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useProfile } from '@/api/hooks/useMetricas';
import { useUnpaidMultaCount } from '@/api/hooks/useMultas';
import type { CategoriaUsuario } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

type Row = { icon: IconName; label: string; href?: string };

const ROWS: Row[] = [
  { icon: 'card-outline', label: 'Gestión de pagos', href: '/payments' },
  { icon: 'time-outline', label: 'Historial', href: '/history' },
  { icon: 'cloud-upload-outline', label: 'Cargar producto', href: '/upload-product' },
  { icon: 'cube-outline', label: 'Mis productos', href: '/product-status' },
  { icon: 'shield-checkmark-outline', label: 'Seguros y depósitos', href: '/seguros' },
  { icon: 'warning-outline', label: 'Mis multas', href: '/multas' },
  { icon: 'notifications-outline', label: 'Notificaciones', href: '/notifications' },
  { icon: 'settings-outline', label: 'Ajustes', href: '/settings' },
];

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initials(nombre: string, apellido: string): string {
  const a = nombre?.trim()?.[0] ?? '';
  const b = apellido?.trim()?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { usuario, usuarioId, logout } = useSession();
  const q = useProfile(usuarioId);
  const unpaidMultas = useUnpaidMultaCount(usuarioId);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  // Static navigation rows + logout: shared across every render state.
  const navSection = (
    <>
      <Card padded={false}>
        {ROWS.map((row, i) => {
          const showMultaBadge = row.href === '/multas' && unpaidMultas > 0;
          return (
            <View key={row.label}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
              <Card
                padded={false}
                onPress={row.href ? () => router.push(row.href as any) : undefined}
                style={styles.rowInner}>
                <View style={styles.rowLeft}>
                  <Icon
                    name={row.icon}
                    size={20}
                    color={showMultaBadge ? theme.danger : theme.primary}
                  />
                  <ThemedText
                    type="default"
                    style={showMultaBadge ? { color: theme.danger } : undefined}>
                    {row.label}
                  </ThemedText>
                  {showMultaBadge ? (
                    <View style={[styles.multaBadge, { backgroundColor: theme.danger }]}>
                      <ThemedText type="caption" style={{ color: '#fff', fontSize: 11 }}>
                        {unpaidMultas}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
              </Card>
            </View>
          );
        })}
      </Card>

      <Card onPress={handleLogout} style={styles.logout}>
        <View style={styles.rowLeft}>
          <Icon name="log-out-outline" size={20} color={theme.danger} />
          <ThemedText type="default" style={{ color: theme.danger }}>
            Cerrar sesión
          </ThemedText>
        </View>
      </Card>
    </>
  );

  // No session — guard before hooks would otherwise need an id.
  if (usuarioId == null) {
    return (
      <Screen edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="title">Perfil</ThemedText>
          <EmptyState icon="person-outline" message="Iniciá sesión para ver tu perfil." />
          <Card onPress={() => router.replace('/(auth)/login')} style={styles.logout}>
            <View style={styles.rowLeft}>
              <Icon name="log-out-outline" size={20} color={theme.danger} />
              <ThemedText type="default" style={{ color: theme.danger }}>
                Ir a iniciar sesión
              </ThemedText>
            </View>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  // Prefer freshly fetched usuario; fall back to the session copy while loading.
  const u = q.data?.usuario ?? usuario;
  const metricas = q.data?.metricas;

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="title">Perfil</ThemedText>

        {q.isLoading && !u ? (
          <LoadingState message="Cargando perfil…" />
        ) : q.isError && !u ? (
          <ErrorState message="No pudimos cargar tu perfil." onRetry={q.refetch} />
        ) : u ? (
          <Card elevated style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: theme.primaryGlow }]}>
                <ThemedText type="heading" style={{ color: theme.primary }}>
                  {initials(u.nombre, u.apellido)}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="heading">
                  {u.nombre} {u.apellido}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {u.email}
                </ThemedText>
                <View style={[styles.tier, { backgroundColor: theme.primaryGlow }]}>
                  <Icon name="star" size={12} color={theme.primary} />
                  <ThemedText type="caption" style={{ color: theme.primary }}>
                    Miembro {capitalize(u.categoria as CategoriaUsuario)}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={[styles.stats, { borderTopColor: theme.border }]}>
              <View style={styles.stat}>
                <ThemedText type="subtitle">{metricas?.cantidad_pujas ?? '—'}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Pujas
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText type="subtitle">{metricas?.subastas_ganadas ?? '—'}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Ganadas
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText type="subtitle">{metricas?.subastas_asistidas ?? '—'}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Asistidas
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}

        {navSection}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.seven },
  profileCard: { gap: Spacing.four },
  profileRow: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    marginTop: Spacing.two,
  },
  stats: { flexDirection: 'row', borderTopWidth: 1, paddingTop: Spacing.four },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { height: 1, marginHorizontal: Spacing.four },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  logout: { alignItems: 'center' },
  multaBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
});
