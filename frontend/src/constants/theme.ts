/**
 * Bidify design system — dark auction app.
 *
 * The app is dark-only by design, so the `light` and `dark` palettes are
 * intentionally identical. Keeping both keys preserves compatibility with the
 * themed components (useTheme / ThemedView / ThemedText) and react-navigation.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  // Surfaces
  background: '#141923',
  backgroundElement: '#1C2230',
  backgroundSelected: '#262E3D',
  card: '#1A202C',
  cardElevated: '#222A38',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9AA3B2',
  textMuted: '#6B7280',

  // Brand
  primary: '#E9C349',
  primaryDim: 'rgba(233,195,73,0.4)',
  primaryGlow: 'rgba(233,195,73,0.1)',
  onPrimary: '#141923',

  // Borders / dividers
  border: '#2A3242',
  borderStrong: '#3A4455',

  // Status
  live: '#E5484D',
  liveDim: 'rgba(229,72,77,0.15)',
  upcoming: '#3B82F6',
  upcomingDim: 'rgba(59,130,246,0.15)',
  success: '#30A46C',
  successDim: 'rgba(48,164,108,0.15)',
  warning: '#F5A623',
  danger: '#E5484D',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
} as const;

export type ThemeColor = keyof typeof palette;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
