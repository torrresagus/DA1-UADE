import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BidifyMark } from '@/components/ui/bidify-mark';
import { Button } from '@/components/ui/button';
import { Icon, IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ONBOARDING_SEEN_KEY = 'bidify.onboardingSeen';

type Slide = { icon: IconName; title: string; body: string };

const SLIDES: Slide[] = [
  {
    icon: 'hammer-outline',
    title: 'Subastas de Élite',
    body: 'Accedé a piezas únicas de colección y pujá en tiempo real en subastas premium.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Compra con confianza',
    body: 'Vendedores verificados, pagos protegidos y autenticidad garantizada.',
  },
  {
    icon: 'trophy-outline',
    title: 'Participá en Subastas',
    body: 'Seguí tus pujas, recibí alertas y llevate la pieza que querés.',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
    router.replace('/(auth)/login');
  };

  const next = () => {
    if (isLast) finishOnboarding();
    else setIndex((i) => i + 1);
  };

  return (
    <Screen padded>
      <View style={styles.skipRow}>
        <Button title="Saltar" variant="ghost" size="sm" onPress={finishOnboarding} />
      </View>

      <View style={styles.body}>
        <View style={[styles.iconCircle, { borderColor: theme.primaryDim, backgroundColor: theme.card }]}>
          <Icon name={slide.icon} size={56} color={theme.primary} />
        </View>
        <ThemedText type="title" style={styles.center}>
          {slide.title}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
          {slide.body}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? theme.primary : theme.border,
                  width: i === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
        <Button title={isLast ? 'Comenzar' : 'Siguiente'} fullWidth onPress={next} />
      </View>

      <View style={styles.markWrap}>
        <BidifyMark size={28} glow={false} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipRow: { alignItems: 'flex-end', paddingTop: Spacing.two },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  footer: { gap: Spacing.five, paddingBottom: Spacing.four },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { height: 8, borderRadius: 4 },
  markWrap: { alignItems: 'center', paddingBottom: Spacing.two, opacity: 0.6 },
});
