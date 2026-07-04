import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fmtPrice } from '@/utils/format';
import type { Moneda } from '@/api/types';

export type Auction = {
  id: string;
  title: string;
  image: string;
  currentBid: number;
  bidLabel?: string;
  moneda: Moneda;
  category?: string;
  status: 'live' | 'upcoming' | 'closed';
  statusLabel?: string;
  endsInLabel?: string;
  locked?: boolean;
  esColeccion?: boolean;
  nombreColeccion?: string | null;
  categoriaMinima?: string;
};

const statusTone: Record<Auction['status'], BadgeTone> = {
  live: 'live',
  upcoming: 'upcoming',
  closed: 'neutral',
};

function formatPrice(value: number, moneda: Moneda) {
  return '$' + fmtPrice(value) + ' ' + moneda;
}

type AuctionCardProps = {
  auction: Auction;
  onPress?: () => void;
  onBid?: () => void;
};

export function AuctionCard({ auction, onPress, onBid }: AuctionCardProps) {
  const theme = useTheme();
  const liveOrUpcoming = auction.status !== 'closed';

  return (
    <Card padded={false} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: auction.image }} style={styles.image} contentFit="cover" />
        <View style={styles.topRow}>
          {auction.category ? <Badge label={auction.category} tone="gold" /> : <View />}
          {auction.statusLabel ? (
            <Badge
              label={auction.statusLabel}
              tone={statusTone[auction.status]}
              dot={auction.status === 'live'}
            />
          ) : null}
        </View>
        {auction.endsInLabel ? (
          <View style={[styles.timer, { backgroundColor: 'rgba(20,25,35,0.85)' }]}>
            <Icon name="time-outline" size={14} color={theme.primary} />
            <ThemedText type="caption" style={{ color: theme.primary }}>
              {auction.endsInLabel}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <ThemedText type="heading" numberOfLines={1}>
          {auction.title}
        </ThemedText>
        {auction.esColeccion ? (
          <Badge
            label={auction.nombreColeccion ?? 'Colección'}
            tone="upcoming"
            style={styles.collectionBadge}
          />
        ) : null}
        <View style={styles.bidRow}>
          <View>
            <ThemedText type="caption" themeColor="textSecondary">
              {auction.locked ? 'Acceso restringido' : (auction.bidLabel ?? 'Puja actual')}
            </ThemedText>
            {auction.locked ? (
              <View style={styles.lockRow}>
                <Icon name="lock-closed" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Platino
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="price">{formatPrice(auction.currentBid, auction.moneda)}</ThemedText>
            )}
          </View>
          <Button
            title={auction.locked ? 'Bloqueado' : 'Pujar'}
            size="sm"
            variant={liveOrUpcoming && !auction.locked ? 'primary' : 'secondary'}
            disabled={auction.locked || auction.status === 'closed'}
            onPress={onBid}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    height: 180,
    backgroundColor: '#0E121A',
  },
  image: { width: '100%', height: '100%' },
  topRow: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timer: {
    position: 'absolute',
    bottom: Spacing.three,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
  },
  body: { padding: Spacing.four, gap: Spacing.three },
  bidRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: 2 },
  collectionBadge: { alignSelf: 'flex-start' },
});
