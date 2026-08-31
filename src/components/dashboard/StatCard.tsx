import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  tint: string;
  tintSoft: string;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function StatCard({ icon, value, label, tint, tintSoft, onPress }: StatCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={!onPress}
      onPressIn={() => {
        if (onPress) scale.value = withSpring(0.94, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        if (onPress) scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
      style={[
        styles.card,
        { borderColor: withAlpha(tint, 0.3), backgroundColor: withAlpha(tint, 0.07) },
        glow(tint, 0.22, 12, 4),
        animatedStyle,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tintSoft }, glow(tint, 0.4, 8, 3)]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={[styles.value, { color: tint }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    value: { ...typography.h2, color: colors.textPrimary, fontWeight: '800' },
    label: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  });
