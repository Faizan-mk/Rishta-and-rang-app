import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface HeartSpec {
  left: DimensionValue;
  size: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
}

function buildHearts(colors: string[]): HeartSpec[] {
  const lefts = ['4%', '18%', '32%', '50%', '64%', '78%', '90%', '10%', '58%'] as const;
  return lefts.map((left, index) => ({
    left,
    size: 16 + ((index * 7) % 22),
    delay: (index * 260) % 1800,
    duration: 3200 + ((index * 400) % 1600),
    color: colors[index % colors.length],
    rotate: index % 2 === 0 ? -12 : 12,
  }));
}

function FloatingHeart({ spec }: { spec: HeartSpec }) {
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(spec.rotate);

  useEffect(() => {
    translateY.value = withDelay(
      spec.delay,
      withRepeat(withTiming(-140, { duration: spec.duration, easing: Easing.out(Easing.quad) }), -1, false)
    );
    opacity.value = withDelay(
      spec.delay,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: spec.duration * 0.25 }),
          withTiming(0.55, { duration: spec.duration * 0.45 }),
          withTiming(0, { duration: spec.duration * 0.3 })
        ),
        -1,
        false
      )
    );
    rotate.value = withRepeat(
      withSequence(
        withTiming(-spec.rotate, { duration: spec.duration / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(spec.rotate, { duration: spec.duration / 2, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.heart, { left: spec.left }, style]} pointerEvents="none">
      <Ionicons name="heart" size={spec.size} color={spec.color} />
    </Animated.View>
  );
}

export function FloatingHearts({ colors }: { colors: string[] }) {
  const hearts = React.useMemo(() => buildHearts(colors), [colors]);

  return (
    <View style={styles.container} pointerEvents="none">
      {hearts.map((spec, index) => (
        <FloatingHeart key={index} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.flatten(StyleSheet.absoluteFill), overflow: 'hidden' },
  heart: { position: 'absolute', bottom: 0 },
});
