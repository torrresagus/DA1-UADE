import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STEPS = ['CUENTA', 'VALIDACIÓN', 'FINALIZAR'] as const;

/** The 1-2-3 progress header from the Figma registration flow. `current` is 1-based. */
export function RegisterSteps({ current }: { current: number }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        const reached = done || active;
        return (
          <View key={label} style={styles.item}>
            <View style={styles.stepRow}>
              {i > 0 ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: done || active ? theme.primary : theme.border },
                  ]}
                />
              ) : (
                <View style={styles.line} />
              )}
              <View
                style={[
                  styles.bullet,
                  {
                    backgroundColor: reached ? theme.primary : 'transparent',
                    borderColor: reached ? theme.primary : theme.border,
                  },
                ]}>
                {done ? (
                  <Icon name="checkmark" size={14} color={theme.onPrimary} />
                ) : (
                  <ThemedText
                    type="smallBold"
                    style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
                    {step}
                  </ThemedText>
                )}
              </View>
              {i < STEPS.length - 1 ? (
                <View
                  style={[styles.line, { backgroundColor: done ? theme.primary : theme.border }]}
                />
              ) : (
                <View style={styles.line} />
              )}
            </View>
            <ThemedText
              type="caption"
              style={{ color: reached ? theme.primary : theme.textSecondary }}>
              {label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', gap: Spacing.two },
  stepRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2 },
  bullet: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
