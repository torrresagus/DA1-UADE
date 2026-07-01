import { Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Action = { label: string; onPress: () => void };

type Props = {
  visible: boolean;
  title?: string;
  message: string;
  primaryAction: Action;
  secondaryAction?: Action;
};

export function GuestAccessModal({
  visible,
  title = 'Acceso restringido',
  message,
  primaryAction,
  secondaryAction,
}: Props) {
  const theme = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: theme.primaryGlow }]}>
            <Icon name="lock-closed" size={28} color={theme.primary} />
          </View>

          <ThemedText type="heading" style={styles.centered}>
            {title}
          </ThemedText>

          <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
            {message}
          </ThemedText>

          <View style={styles.actions}>
            {secondaryAction ? (
              <Button
                title={secondaryAction.label}
                variant="ghost"
                fullWidth
                onPress={secondaryAction.onPress}
              />
            ) : null}
            <Button title={primaryAction.label} fullWidth onPress={primaryAction.onPress} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  card: {
    width: '100%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  centered: { textAlign: 'center' },
  actions: {
    width: '100%',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
