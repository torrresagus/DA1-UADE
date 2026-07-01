import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

const ONBOARDING_SEEN_KEY = 'bidify.onboardingSeen';
const hero = require('@/assets/images/logo-glow.png');

export default function WelcomeScreen() {
  const theme = useTheme();
  const { enterGuestMode } = useSession();

  const markSeen = () => AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});

  const onStart = async () => {
    await markSeen();
    router.replace('/(auth)/register-account');
  };

  const onHaveAccount = async () => {
    await markSeen();
    router.replace('/(auth)/login');
  };

  const onGuest = async () => {
    await markSeen();
    await enterGuestMode();
    router.replace('/(tabs)/home');
  };

  return (
    <Screen padded>
      <View style={styles.hero}>
        <Image source={hero} style={styles.heroImage} contentFit="contain" />
        <ThemedText type="title" style={styles.wordmark}>
          BIDIFY
        </ThemedText>
      </View>

      <View style={styles.copy}>
        <ThemedText type="subtitle" style={styles.center}>
          Bienvenido al mundo de las subastas exclusivas
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
          Bidify es la plataforma premium de subastas online para activos exclusivos y piezas únicas.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button title="COMENZAR" fullWidth onPress={onStart} />
        <Button
          title="YA TENGO UNA CUENTA"
          variant="ghost"
          fullWidth
          style={{ borderColor: theme.primaryDim }}
          onPress={onHaveAccount}
        />
        <Button
          title="Continuar como invitado"
          variant="ghost"
          fullWidth
          onPress={onGuest}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  heroImage: { width: 220, height: 220 },
  wordmark: { letterSpacing: 4 },
  copy: { gap: Spacing.three, paddingBottom: Spacing.six },
  center: { textAlign: 'center' },
  actions: { gap: Spacing.three, paddingBottom: Spacing.six },
});
