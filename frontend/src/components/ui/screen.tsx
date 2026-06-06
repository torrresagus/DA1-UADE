import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Apply default horizontal padding to the content area. */
  padded?: boolean;
  edges?: readonly Edge[];
  style?: ViewStyle;
};

/** Full-screen dark surface with safe-area handling — the base for every screen. */
export function Screen({ children, padded = false, edges = ['top', 'bottom'], style }: ScreenProps) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={edges} style={[styles.safe, padded && styles.padded, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  padded: { paddingHorizontal: 16 },
});
