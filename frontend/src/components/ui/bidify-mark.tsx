import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const logo = require('@/assets/images/bidify-logo.png');

type BidifyMarkProps = {
  size?: number;
  glow?: boolean;
};

/** The Bidify gavel mark inside its circular gold-bordered badge, with optional radial glow. */
export function BidifyMark({ size = 112, glow = true }: BidifyMarkProps) {
  const theme = useTheme();
  const glowSize = size * 1.7;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {glow ? (
        <View
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              backgroundColor: theme.primaryGlow,
              top: (size - glowSize) / 2,
              left: (size - glowSize) / 2,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: Radius.pill,
            backgroundColor: theme.background,
            borderColor: theme.primaryDim,
          },
        ]}>
        <Image
          source={logo}
          style={{ width: size * 0.92, height: size * 0.92 }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
