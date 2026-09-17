import React from 'react';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import type { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';

interface FadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  from?: 'up' | 'down';
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

// Typed as a plain `View` ref rather than reanimated's own (untyped-for-this)
// component instance: the node underneath is a real host view either way, so
// callers can use ordinary View imperative methods like `measureInWindow` on
// it — reanimated's exported type just doesn't declare them.
export const FadeIn = React.forwardRef<View, FadeInUpProps>(function FadeIn(
  { children, delay = 0, from = 'up', style, onLayout },
  ref
) {
  const entering = (from === 'up' ? FadeInUp : FadeInDown).delay(delay).duration(420).springify().damping(16);
  return (
    <Animated.View ref={ref as React.Ref<never>} entering={entering} style={style} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
});
