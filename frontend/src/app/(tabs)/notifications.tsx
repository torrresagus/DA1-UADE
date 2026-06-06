import { ScrollView, StyleSheet, View } from 'react-native';

import { num } from '@/api/types';
import { useMultasUsuario } from '@/api/hooks/useMultas';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Icon, IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';
import { router } from 'expo-router';

type Notif = {
  id: string;
  icon: IconName;
  tone: 'danger';
  title: string;
  body: string;
  onPress?: () => void;
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();
  const multas = useMultasUsuario(usuarioId);

  const toneColor = { danger: theme.danger };

  const head = (
    <View style={styles.head}>
      <ThemedText type="title">Notificaciones</ThemedText>
      <ThemedText type="link" style={{ color: theme.primary }} onPress={() => {}}>
        Marcar todo
      </ThemedText>
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

  const notifs: Notif[] = (multas.data ?? [])
    .filter((m) => m.pagada === false)
    .map((m) => ({
      id: String(m.id),
      icon: 'card' as IconName,
      tone: 'danger' as const,
      title: 'Tienes una multa impaga',
      body: `${m.motivo} — $${num(m.monto).toLocaleString('en-US')}`,
      onPress: () => router.push('/payments'),
    }));

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {head}

        {notifs.length === 0 ? (
          <EmptyState icon="notifications-outline" message="No tenés notificaciones por ahora" />
        ) : (
          notifs.map((n) => (
            <Card key={n.id} elevated onPress={n.onPress} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: theme.cardElevated }]}>
                <Icon name={n.icon} size={18} color={toneColor[n.tone]} />
              </View>
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                    {n.title}
                  </ThemedText>
                  <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {n.body}
                </ThemedText>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.seven },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.one },
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
