import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { num } from '@/api/types';
import { fmtPrice } from '@/utils/format';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ResultScreen() {
  const theme = useTheme();
  const { title, monto } = useLocalSearchParams<{
    title?: string;
    monto?: string;
    status?: string;
  }>();
  const montoN = num(monto);
  const montoLabel = `$${fmtPrice(montoN)}`;

  return (
    <Screen padded>
      <View style={styles.body}>
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={[styles.trophy, { backgroundColor: theme.primaryGlow, borderColor: theme.primaryDim }]}>
          <Icon name="checkmark-circle" size={64} color={theme.primary} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)} style={styles.textBlock}>
          <ThemedText type="title" style={styles.center}>
            Puja confirmada
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            Tu puja de {montoLabel} fue registrada. Te avisaremos si resultás ganador.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.fullWidth}>
          <Card elevated style={styles.itemCard}>
            <View style={styles.flex}>
              <ThemedText type="heading">{title || 'Lote'}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Tu puja
              </ThemedText>
              <ThemedText type="price">{montoLabel}</ThemedText>
            </View>
          </Card>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Button title="Ver mi historial" fullWidth onPress={() => router.replace('/history')} />
        <Button
          title="Volver a subastas"
          variant="ghost"
          fullWidth
          onPress={() => router.replace('/(tabs)/home')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fullWidth: { alignSelf: 'stretch' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  trophy: {
    width: 140,
    height: 140,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { gap: Spacing.two },
  center: { textAlign: 'center' },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  footer: { gap: Spacing.two, paddingBottom: Spacing.four },
});
