import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import {
  HOME_FILTERS,
  PRODUCT_CATEGORIES,
  TIER_FILTERS,
  TIER_FILTER_VALUE,
  type HomeFilter,
  type TierFilter,
} from '@/api/categories';
import { useAuctions } from '@/api/hooks/useAuctions';
import { useUnpaidMultaCount } from '@/api/hooks/useMultas';
import { AuctionCard } from '@/components/auction-card';
import { ThemedText } from '@/components/themed-text';
import { BidifyMark } from '@/components/ui/bidify-mark';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

const ALL_CATEGORIES = ['Todas', ...PRODUCT_CATEGORIES] as const;
type CategoryFilter = (typeof ALL_CATEGORIES)[number];
type ActiveSheet = 'status' | 'tier' | 'type' | null;

// ─── FilterPill ───────────────────────────────────────────────────────────────

function FilterPill({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active ? theme.primaryGlow : theme.cardElevated,
          borderColor: active ? theme.primary : theme.border,
        },
        pressed && { opacity: 0.75 },
      ]}>
      <View style={styles.pillContent}>
        <ThemedText
          type="caption"
          style={{ color: theme.textSecondary }}
          numberOfLines={1}>
          {label}
        </ThemedText>
        <View style={styles.pillBottom}>
          <ThemedText
            type="smallBold"
            style={{ color: active ? theme.primary : theme.text, flex: 1 }}
            numberOfLines={1}>
            {value}
          </ThemedText>
          <Icon
            name="chevron-down"
            size={13}
            color={active ? theme.primary : theme.textSecondary}
          />
        </View>
      </View>
    </Pressable>
  );
}

// ─── FilterSheet ──────────────────────────────────────────────────────────────

function FilterSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheet.outer}>
        <Pressable style={[StyleSheet.absoluteFill, sheet.backdrop]} onPress={onClose} />
        <View style={[sheet.panel, { backgroundColor: theme.card }]}>
          <View style={sheet.header}>
            <ThemedText type="heading">{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          {options.map((opt, i) => {
            const isSelected = opt === selected;
            return (
              <Pressable
                key={opt}
                onPress={() => onSelect(opt)}
                style={({ pressed }) => [
                  sheet.option,
                  i < options.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                  pressed && { opacity: 0.6 },
                ]}>
                <ThemedText
                  type="default"
                  style={isSelected ? { color: theme.primary, fontWeight: '700' } : undefined}>
                  {opt}
                </ThemedText>
                {isSelected ? (
                  <Icon name="checkmark" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const theme = useTheme();
  const { usuario, usuarioId, isGuest, exitGuestMode } = useSession();
  // El invitado navega el catálogo (público) pero no envía usuario_id: el backend
  // le oculta el precio base. El registrado sí lo envía y ve los precios.
  const auctions = useAuctions({
    usuarioCategoria: isGuest ? 'platino' : usuario?.categoria,
    usuarioId: isGuest ? null : usuarioId,
  });
  const unpaid = useUnpaidMultaCount(usuarioId);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HomeFilter>('Todas');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todas');
  const [tierFilter, setTierFilter] = useState<TierFilter>('Todas');
  const [openSheet, setOpenSheet] = useState<ActiveSheet>(null);

  const data = useMemo(() => {
    return (auctions.data ?? []).filter((a) => {
      const matchesQuery = a.title.toLowerCase().includes(query.trim().toLowerCase());
      const matchesStatus =
        filter === 'Todas' ||
        (filter === 'En vivo' && a.status === 'live') ||
        (filter === 'Próximas' && a.status === 'upcoming');
      const matchesCategory = categoryFilter === 'Todas' || a.category === categoryFilter;
      const tierValue = TIER_FILTER_VALUE[tierFilter];
      const matchesTier = tierValue === null || a.categoriaMinima === tierValue;
      return matchesQuery && matchesStatus && matchesCategory && matchesTier;
    });
  }, [auctions.data, query, filter, categoryFilter, tierFilter]);

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
            {/* Top bar */}
            <View style={styles.topBar}>
              <View style={styles.brand}>
                <BidifyMark size={36} glow={false} />
                <ThemedText type="subtitle">Bidify</ThemedText>
              </View>
              <View style={styles.topRight}>
                {isGuest ? (
                  <Pressable
                    onPress={async () => {
                      await exitGuestMode();
                      router.replace('/(auth)/login');
                    }}
                    style={[
                      styles.guestBtn,
                      { backgroundColor: theme.cardElevated, borderColor: theme.border },
                    ]}>
                    <Icon name="log-in-outline" size={15} color={theme.primary} />
                    <ThemedText type="caption" style={{ color: theme.primary }}>
                      Iniciar sesión
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => router.push('/notifications')}
                  style={[styles.iconBtn, { backgroundColor: theme.cardElevated }]}>
                  <Icon name="notifications-outline" size={20} color={theme.primary} />
                  {notifDot ? (
                    <View style={[styles.notifDot, { backgroundColor: theme.live }]} />
                  ) : null}
                </Pressable>
              </View>
            </View>

            {/* Buscador */}
            <Input
              placeholder="Buscar subastas"
              value={query}
              onChangeText={setQuery}
              leading={<Icon name="search" size={18} color={theme.textSecondary} />}
            />

            {/* Filtros — una sola fila de 3 pills */}
            <View style={styles.filterRow}>
              <FilterPill
                label="Estado"
                value={filter}
                active={filter !== 'Todas'}
                onPress={() => setOpenSheet('status')}
              />
              <FilterPill
                label="Nivel"
                value={tierFilter}
                active={tierFilter !== 'Todas'}
                onPress={() => setOpenSheet('tier')}
              />
              <FilterPill
                label="Tipo"
                value={categoryFilter}
                active={categoryFilter !== 'Todas'}
                onPress={() => setOpenSheet('type')}
              />
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

      {/* Sheets de filtro */}
      <FilterSheet
        visible={openSheet === 'status'}
        title="Estado"
        options={HOME_FILTERS}
        selected={filter}
        onSelect={(v) => { setFilter(v as HomeFilter); setOpenSheet(null); }}
        onClose={() => setOpenSheet(null)}
      />
      <FilterSheet
        visible={openSheet === 'tier'}
        title="Nivel de acceso"
        options={TIER_FILTERS}
        selected={tierFilter}
        onSelect={(v) => { setTierFilter(v as TierFilter); setOpenSheet(null); }}
        onClose={() => setOpenSheet(null)}
      />
      <FilterSheet
        visible={openSheet === 'type'}
        title="Tipo de artículo"
        options={ALL_CATEGORIES}
        selected={categoryFilter}
        onSelect={(v) => { setCategoryFilter(v as CategoryFilter); setOpenSheet(null); }}
        onClose={() => setOpenSheet(null)}
      />
    </Screen>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.three,
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
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pillContent: {
    gap: 2,
  },
  pillBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});

const sheet = StyleSheet.create({
  outer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
});
