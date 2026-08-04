import React from 'react';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

interface FadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  from?: 'up' | 'down';
  style?: ViewStyle;
}

export function FadeIn({ children, delay = 0, from = 'up', style }: FadeInUpProps) {
  const entering = (from === 'up' ? FadeInUp : FadeInDown).delay(delay).duration(420).springify().damping(16);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
