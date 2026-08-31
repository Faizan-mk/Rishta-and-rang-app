import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import type { ProfileMode } from '../../types/user';

// React Native has no radial gradient, and a handful of rings reads as visible
// bands. Ten of them, each barely opaque, compound into a smooth falloff —
// roughly 20% at the core, faint enough that a white card still reads cleanly
// over it, and fading to nothing at the blob's edge.
const RING_COUNT = 10;
const RING_ALPHA = 0.022;

interface OrbSpec {
  color: string;
  // Everything is a fraction of screen width/height so a blob lands in the same
  // place on a small phone and a tablet.
  size: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
}

function SoftOrb({ spec }: { spec: OrbSpec }) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      spec.delay,
      withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
    // Specs are rebuilt per mode, which remounts the orb and restarts the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * spec.driftX },
      { translateY: drift.value * spec.driftY },
      { scale: 0.92 + drift.value * 0.16 },
    ],
  }));

  const rings = useMemo(
    () =>
      Array.from({ length: RING_COUNT }, (_, i) => {
        // Ring 0 is the full blob, the last is the small bright core.
        const inset = (i / RING_COUNT) * (spec.size / 2);
        const diameter = spec.size - inset * 2;
        return {
          key: i,
          style: {
            position: 'absolute' as const,
            left: inset,
            top: inset,
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: withAlpha(spec.color, RING_ALPHA),
          },
        };
      }),
    [spec.size, spec.color]
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        { width: spec.size, height: spec.size, left: spec.x, top: spec.y },
        style,
      ]}
    >
      {rings.map((ring) => (
        <View key={ring.key} style={ring.style} />
      ))}
    </Animated.View>
  );
}

interface AuroraBackgroundProps {
  colors: Palette;
  mode: ProfileMode;
  // Extends the field past its parent's padding. Absolutely positioned children
  // sit inside the padding box, so on a padded screen the wash would otherwise
  // stop short and show its own clipped rectangle.
  bleed?: number;
}

// Slow colour drifting behind the whole Home screen, carrying the mode's own
// hues so switching Friends/Rishta repaints the room the deck sits in. It moves
// on a ~20 second cycle: at that speed it registers as depth rather than as
// something competing with the card for attention.
export const AuroraBackground = React.memo(function AuroraBackground({ colors, mode, bleed = 0 }: AuroraBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const accent = modeAccent(colors, mode);

  const orbs = useMemo<OrbSpec[]>(
    () => [
      {
        color: accent.primary,
        size: width * 1.05,
        x: -width * 0.42,
        y: -height * 0.14,
        driftX: width * 0.07,
        driftY: height * 0.04,
        duration: 19000,
        delay: 0,
      },
      {
        color: accent.secondary,
        size: width * 0.95,
        x: width * 0.45,
        y: height * 0.22,
        driftX: -width * 0.08,
        driftY: -height * 0.05,
        duration: 23000,
        delay: 1200,
      },
      {
        color: colors.plum,
        size: width * 1.15,
        x: -width * 0.3,
        y: height * 0.62,
        driftX: width * 0.06,
        driftY: -height * 0.04,
        duration: 27000,
        delay: 2400,
      },
    ],
    [accent.primary, accent.secondary, colors.plum, width, height]
  );

  return (
    <View style={[styles.field, bleed > 0 && { top: -bleed, left: -bleed, right: -bleed, bottom: -bleed }]} pointerEvents="none">
      {/* Keying on the mode restarts every drift together, so the two colour
          worlds never cross-fade half-way through a cycle. */}
      {orbs.map((spec, index) => (
        <SoftOrb key={`${mode}-${index}`} spec={spec} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  orb: { position: 'absolute' },
});
