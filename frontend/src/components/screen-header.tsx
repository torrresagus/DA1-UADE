import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenHeaderProps = {
  title?: string;
  onBack?: () => void;
  rightIcon?: IconName;
  onRightPress?: () => void;
};

export function ScreenHeader({ title, onBack, rightIcon, onRightPress }: ScreenHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={[styles.iconBtn, { backgroundColor: theme.cardElevated }]}>
        <Icon name="chevron-back" size={22} />
      </Pressable>
      {title ? (
        <ThemedText type="heading" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
      ) : (
        <View style={styles.title} />
      )}
      {rightIcon ? (
        <Pressable
          onPress={onRightPress}
          style={[styles.iconBtn, { backgroundColor: theme.cardElevated }]}>
          <Icon name={rightIcon} size={20} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center' },
});
