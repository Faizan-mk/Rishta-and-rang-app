import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'dating' | 'rishta';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

// A selected chip fills with its tone's own ramp and throws that colour as a
// shadow, so a row of chips shows what's on at a glance rather than relying on
// a border-versus-fill difference.
export function Chip({ label, selected, onPress, tone = 'neutral' }: ChipProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const toneColor = tone === 'dating' ? colors.dating : tone === 'rishta' ? colors.rishta : colors.teal;
  const toneEnd = tone === 'dating' ? colors.gold : tone === 'rishta' ? colors.teal : colors.sage;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const body = <Text style={[styles.label, { color: selected ? '#FFFFFF' : toneColor }]}>{label}</Text>;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.94, { damping: 14, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={[styles.wrap, selected && glow(toneColor, 0.5, 12, 5), animatedStyle]}
    >
      {selected ? (
        <LinearGradient colors={[toneColor, toneEnd]} start={GRADIENT_START} end={GRADIENT_END} style={styles.chip}>
          {body}
        </LinearGradient>
      ) : (
        <View
          style={[styles.chip, styles.chipIdle, { borderColor: withAlpha(toneColor, 0.45), backgroundColor: withAlpha(toneColor, 0.08) }]}
        >
          {body}
        </View>
      )}
    </AnimatedPressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      borderRadius: radius.pill,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 3,
    },
    chipIdle: { borderWidth: 1.5 },
    label: { ...typography.label, fontWeight: '700', flexShrink: 0 },
  });
