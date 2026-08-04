import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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

interface SwingingLogoProps {
  size?: number;
  color: string;
  ringColor: string;
}

export function SwingingLogo({ size = 88, color, ringColor }: SwingingLogoProps) {
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.12, { duration: 420, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 180 })
    );
    rotate.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-14, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(14, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(-8, { duration: 340, easing: Easing.inOut(Easing.sin) }),
          withTiming(8, { duration: 340, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 260, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: ringColor }, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name="heart" size={size * 0.48} color={color} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
});
