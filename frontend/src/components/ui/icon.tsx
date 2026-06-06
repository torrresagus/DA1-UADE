import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';

import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/** Thin wrapper over Ionicons that defaults to the theme's primary text color. */
export function Icon({ name, size = 22, color }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={color ?? theme.text} />;
}
