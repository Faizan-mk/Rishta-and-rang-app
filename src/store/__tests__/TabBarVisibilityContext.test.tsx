import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { TabBarVisibilityProvider, useHideTabBarOnScroll, useTabBarAnimatedStyle } from '../TabBarVisibilityContext';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// `translateY` is a reanimated SharedValue driving a UI-thread animation:
// `useAnimatedStyle`'s output is pushed straight to the native view rather than
// through React props/state, so it isn't observable from a plain RNTL render
// without reanimated's dedicated (and currently unstable-to-import under this
// project's module resolution) jest test utils. These tests instead pin the
// handler's public contract: it never throws across the offsets a real scroll
// view can report, for any provider consumer.

function scrollEvent(y: number): NativeSyntheticEvent<NativeScrollEvent> {
  return { nativeEvent: { contentOffset: { y } } } as unknown as NativeSyntheticEvent<NativeScrollEvent>;
}

function renderScroll() {
  return renderHook(
    () => ({ scroll: useHideTabBarOnScroll(), style: useTabBarAnimatedStyle() }),
    { wrapper: ({ children }) => <TabBarVisibilityProvider>{children}</TabBarVisibilityProvider> }
  );
}

describe('useHideTabBarOnScroll', () => {
  it('handles a sustained downward scroll without throwing', () => {
    const { result } = renderScroll();
    expect(() => {
      result.current.scroll(scrollEvent(50));
      result.current.scroll(scrollEvent(90)); // +40, past DIRECTION_THRESHOLD (24)
    }).not.toThrow();
  });

  it('handles a small jitter under the threshold without throwing', () => {
    const { result } = renderScroll();
    expect(() => {
      result.current.scroll(scrollEvent(50));
      result.current.scroll(scrollEvent(55)); // +5, well under the threshold
    }).not.toThrow();
  });

  it('handles a direction reversal without throwing', () => {
    const { result } = renderScroll();
    expect(() => {
      result.current.scroll(scrollEvent(50));
      result.current.scroll(scrollEvent(70)); // downward
      result.current.scroll(scrollEvent(60)); // reverses upward: resets accumulation
      result.current.scroll(scrollEvent(90)); // downward again
    }).not.toThrow();
  });

  it('handles an offset at or below the top-reveal threshold without throwing', () => {
    const { result } = renderScroll();
    expect(() => {
      result.current.scroll(scrollEvent(200));
      result.current.scroll(scrollEvent(5)); // <= TOP_REVEAL_OFFSET (12)
    }).not.toThrow();
  });

  it('clamps a negative (bounce/overscroll) offset without throwing', () => {
    const { result } = renderScroll();
    expect(() => result.current.scroll(scrollEvent(-30))).not.toThrow();
  });
});

describe('useTabBarAnimatedStyle', () => {
  it('resolves to a style object for its consumer', () => {
    const { result } = renderScroll();
    expect(result.current.style).toBeTruthy();
  });
});
