import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { GuestAccessModal } from '@/components/guest-access-modal';
import { ThemedText } from '@/components/themed-text';
import { Icon, IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

const ICONS: Record<string, { active: IconName; inactive: IconName; label: string }> = {
  home: { active: 'home', inactive: 'home-outline', label: 'Inicio' },
  metrics: { active: 'stats-chart', inactive: 'stats-chart-outline', label: 'Métricas' },
  notifications: { active: 'notifications', inactive: 'notifications-outline', label: 'Alertas' },
  profile: { active: 'person', inactive: 'person-outline', label: 'Perfil' },
};

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function BottomTabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isGuest } = useSession();
  const [showGuestModal, setShowGuestModal] = useState(false);

  return (
    <>
      <GuestAccessModal
        visible={showGuestModal}
        message="Necesitás una cuenta para acceder a esta sección."
        primaryAction={{
          label: 'Iniciar sesión',
          onPress: () => {
            setShowGuestModal(false);
            router.replace('/(auth)/login');
          },
        }}
        secondaryAction={{
          label: 'Cancelar',
          onPress: () => setShowGuestModal(false),
        }}
      />
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, Spacing.three),
          },
        ]}>
        {state.routes.map((route, index) => {
          const meta = ICONS[route.name];
          if (!meta) return null;
          const focused = state.index === index;

          const onPress = () => {
            if (isGuest && route.name !== 'home') {
              setShowGuestModal(true);
              return;
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item}>
              <Icon
                name={focused ? meta.active : meta.inactive}
                size={24}
                color={focused ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                type="caption"
                style={{ color: focused ? theme.primary : theme.textSecondary, fontSize: 11 }}>
                {meta.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
});
