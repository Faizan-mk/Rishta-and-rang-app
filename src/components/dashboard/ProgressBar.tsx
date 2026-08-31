import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { radius } from '../../theme';
import { glow } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

export function ProgressBar({ progress, color }: { progress: number; color?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(progress, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const tint = color ?? colors.teal;

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, glow(tint, 0.5, 8, 3), animatedStyle]}>
        <LinearGradient
          colors={[tint, colors.sage]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    track: {
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  });
