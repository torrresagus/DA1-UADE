import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon, IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Centered spinner for full-screen / section loading. */
export function LoadingState({ message, inline = false }: { message?: string; inline?: boolean }) {
  const theme = useTheme();
  return (
    <View style={inline ? styles.inline : styles.fill}>
      <ActivityIndicator color={theme.primary} size={inline ? 'small' : 'large'} />
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.msg}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Error block with the backend detail message and an optional retry. */
export function ErrorState({
  message = 'Algo salió mal.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fill}>
      <Icon name="alert-circle-outline" size={36} color={theme.danger} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.msg}>
        {message}
      </ThemedText>
      {onRetry ? <Button title="Reintentar" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

/** Empty placeholder for lists/sections with no data. */
export function EmptyState({
  icon = 'file-tray-outline',
  message,
}: {
  icon?: IconName;
  message: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fill}>
      <Icon name={icon} size={32} color={theme.textMuted} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.msg}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    minHeight: 200,
  },
  inline: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  msg: { textAlign: 'center' },
});
