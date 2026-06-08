import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProviders } from '@/api/providers';
import { Colors } from '@/constants/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.background,
    card: Colors.dark.card,
    primary: Colors.dark.primary,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.dark.background },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="auction/[id]"
              options={{ animation: 'slide_from_right', presentation: 'card' }}
            />
            <Stack.Screen name="live/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="bid-confirmation" options={{ presentation: 'transparentModal' }} />
            <Stack.Screen name="result" options={{ animation: 'fade' }} />
          </Stack>
        </ThemeProvider>
      </AppProviders>
    </GestureHandlerRootView>
  );
}
