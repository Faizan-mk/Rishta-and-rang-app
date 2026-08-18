import React, { createContext, useContext, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

// Base tab bar height before safe-area inset — screens under MainTabNavigator add
// their own bottom padding (this + insets.bottom) so content never sits under it.
export const TAB_BAR_BASE_HEIGHT = 56;
// How far the bar travels off-screen when hidden — enough to clear its own height
// plus a little extra so no sliver/shadow remains visible.
const TAB_BAR_TRAVEL = 90;
// Cumulative scroll distance in one direction before we react — filters out tiny
// jitters and momentum/bounce so the bar doesn't flicker on small movements.
const DIRECTION_THRESHOLD = 24;
// Always fully show the bar near the top of the content, regardless of direction.
const TOP_REVEAL_OFFSET = 12;

interface TabBarVisibilityContextValue {
  translateY: SharedValue<number>;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | undefined>(undefined);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const translateY = useSharedValue(0);
  const value = useMemo(() => ({ translateY }), [translateY]);
  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

function useTabBarVisibilityContext(): TabBarVisibilityContextValue {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error('useTabBarVisibilityContext must be used within a TabBarVisibilityProvider');
  return ctx;
}

// Consumed by the custom tab bar to animate itself in/out.
export function useTabBarAnimatedStyle() {
  const { translateY } = useTabBarVisibilityContext();
  return useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
}

// Attach the returned handler to a scrollable screen's `onScroll` to drive the
// shared tab bar in/out. Works on plain ScrollView/FlatList `onScroll` (JS thread)
// since mutating a reanimated shared value from JS is enough to drive its UI-thread
// animated style — no need to convert every list to an Animated.FlatList.
export function useHideTabBarOnScroll() {
  const { translateY } = useTabBarVisibilityContext();
  const lastOffset = useRef(0);
  const accumulated = useRef(0);

  return (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = Math.max(e.nativeEvent.contentOffset.y, 0);
    const delta = offsetY - lastOffset.current;
    lastOffset.current = offsetY;

    if (offsetY <= TOP_REVEAL_OFFSET) {
      translateY.value = withTiming(0, { duration: 200 });
      accumulated.current = 0;
      return;
    }

    if (Math.sign(delta) !== Math.sign(accumulated.current)) {
      accumulated.current = 0;
    }
    accumulated.current += delta;

    if (accumulated.current > DIRECTION_THRESHOLD) {
      translateY.value = withTiming(TAB_BAR_TRAVEL, { duration: 220 });
      accumulated.current = 0;
    } else if (accumulated.current < -DIRECTION_THRESHOLD) {
      translateY.value = withTiming(0, { duration: 220 });
      accumulated.current = 0;
    }
  };
}
