import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { HOME_FILTERS, type HomeFilter } from '@/api/categories';
import { useAuctions } from '@/api/hooks/useAuctions';
import { useUnpaidMultaCount } from '@/api/hooks/useMultas';
import { AuctionCard } from '@/components/auction-card';
import { ThemedText } from '@/components/themed-text';
import { BidifyMark } from '@/components/ui/bidify-mark';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const { usuario, usuarioId } = useSession();
  const auctions = useAuctions({ usuarioCategoria: usuario?.categoria });
  const unpaid = useUnpaidMultaCount(usuarioId);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HomeFilter>('Todas');

  const data = useMemo(() => {
    return (auctions.data ?? []).filter((a) => {
      const matchesQuery = a.title.toLowerCase().includes(query.trim().toLowerCase());
      const matchesFilter =
        filter === 'Todas' ||
        (filter === 'En vivo' && a.status === 'live') ||
        (filter === 'Próximas' && a.status === 'upcoming');
      return matchesQuery && matchesFilter;
    });
  }, [auctions.data, query, filter]);

  const notifDot = unpaid > 0;

  return (
    <Screen edges={['top']}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topBar}>
              <View style={styles.brand}>
                <BidifyMark size={36} glow={false} />
                <ThemedText type="subtitle">Bidify</ThemedText>
              </View>
              <Pressable
                onPress={() => router.push('/notifications')}
                style={[styles.iconBtn, { backgroundColor: theme.cardElevated }]}>
                <Icon name="notifications-outline" size={20} color={theme.primary} />
                {notifDot ? (
                  <View style={[styles.notifDot, { backgroundColor: theme.live }]} />
                ) : null}
              </Pressable>
            </View>

            <Input
              placeholder="Buscar subastas"
              value={query}
              onChangeText={setQuery}
              leading={<Icon name="search" size={18} color={theme.textSecondary} />}
            />

            <Pressable
              style={[
                styles.categorySelect,
                { backgroundColor: theme.cardElevated, borderColor: theme.border },
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                Categoría
              </ThemedText>
              <Icon name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>

            <View style={styles.chips}>
              {HOME_FILTERS.map((c) => (
                <Chip key={c} label={c} active={filter === c} onPress={() => setFilter(c)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <AuctionCard
            auction={item}
            onPress={() => router.push(`/auction/${item.id}`)}
            onBid={() =>
              item.status === 'live'
                ? router.push(`/live/${item.id}`)
                : router.push(`/auction/${item.id}`)
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.four }} />}
        ListEmptyComponent={
          auctions.isLoading ? (
            <LoadingState />
          ) : auctions.isError ? (
            <ErrorState onRetry={auctions.refetch} />
          ) : (
            <EmptyState icon="search-outline" message="No hay subastas que coincidan." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categorySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
