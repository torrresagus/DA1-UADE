import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenHeaderProps = {
  title?: string;
  onBack?: () => void;
  /** Ruta a la que ir si no hay stack para volver (router.canGoBack() === false). */
  fallbackRoute?: string;
  rightIcon?: IconName;
  onRightPress?: () => void;
};

export function ScreenHeader({ title, onBack, fallbackRoute, rightIcon, onRightPress }: ScreenHeaderProps) {
  const theme = useTheme();
  const handleBack = onBack ?? (() => {
    if (router.canGoBack()) {
      router.back();
    } else if (fallbackRoute) {
      router.replace(fallbackRoute as any);
    }
  });
  return (
    <View style={styles.row}>
      <Pressable
        onPress={handleBack}
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
