import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tint: string;
  tintSoft: string;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ActionCard({ icon, title, tint, tintSoft, onPress }: ActionCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.94, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
      style={[
        styles.card,
        { borderColor: withAlpha(tint, 0.3), backgroundColor: withAlpha(tint, 0.07) },
        glow(tint, 0.22, 12, 4),
        animatedStyle,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tintSoft }, glow(tint, 0.45, 10, 4)]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={styles.title}>{title}</Text>
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
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: { ...typography.label, color: colors.textPrimary, textAlign: 'center', fontWeight: '700' },
  });
