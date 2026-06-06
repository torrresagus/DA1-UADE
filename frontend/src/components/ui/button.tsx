import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const bg: Record<ButtonVariant, string> = {
    primary: theme.primary,
    secondary: theme.cardElevated,
    ghost: 'transparent',
    danger: theme.danger,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: theme.onPrimary,
    secondary: theme.text,
    ghost: theme.primary,
    danger: '#FFFFFF',
  };
  const sizing: Record<ButtonSize, ViewStyle> = {
    sm: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
    md: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.five },
    lg: { paddingVertical: Spacing.four, paddingHorizontal: Spacing.five },
  };

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        sizing[size],
        { backgroundColor: bg[variant] },
        variant === 'ghost' && { borderWidth: 1, borderColor: theme.border },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.content}>
          {icon}
          <ThemedText type={size === 'sm' ? 'smallBold' : 'heading'} style={{ color: fg[variant] }}>
            {title}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
