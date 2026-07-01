import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BidifyMark } from '@/components/ui/bidify-mark';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';

const ONBOARDING_SEEN_KEY = 'bidify.onboardingSeen';
const MIN_DELAY_MS = 900;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function SplashRoute() {
  const { status, isGuest } = useSession();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    // Never redirect while the session is still re-hydrating from storage.
    if (status === 'restoring') return;

    let active = true;
    (async () => {
      // Decide the destination up front, then enforce a small minimum delay
      // before navigating so the mark gets a beat of screen time (polish).
      let destination: string;
      if (status === 'authed' || isGuest) {
        destination = '/(tabs)/home';
      } else {
        const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY).catch(() => null);
        destination = seen === 'true' ? '/(auth)/login' : '/onboarding';
      }

      await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS));
      if (!active) return;
      // @ts-expect-error expo-router typed routes — destination is a known route string.
      router.replace(destination);
    })();

    return () => {
      active = false;
    };
  }, [status, isGuest]);

  return (
    <Screen>
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.cluster}>
          <BidifyMark size={112} />
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cluster: {
    alignItems: 'center',
    gap: Spacing.five,
  },
});
