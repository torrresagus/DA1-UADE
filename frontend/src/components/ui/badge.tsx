import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'live' | 'upcoming' | 'gold' | 'neutral' | 'success' | 'danger';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  style?: ViewStyle;
};

export function Badge({ label, tone = 'neutral', dot = false, style }: BadgeProps) {
  const theme = useTheme();

  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    live: { bg: theme.liveDim, fg: theme.live },
    upcoming: { bg: theme.upcomingDim, fg: theme.upcoming },
    gold: { bg: theme.primaryGlow, fg: theme.primary },
    neutral: { bg: theme.cardElevated, fg: theme.textSecondary },
    success: { bg: theme.successDim, fg: theme.success },
    danger: { bg: theme.liveDim, fg: theme.danger },
  };
  const { bg, fg } = map[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: fg }]} />}
      <ThemedText type="label" style={{ color: fg, fontSize: 10 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
