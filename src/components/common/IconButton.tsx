import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  badge?: number;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IconButton({ icon, onPress, size = 20, color, background, badge, style }: IconButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
      style={[styles.button, { backgroundColor: background ?? colors.surface }, animatedStyle, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.textPrimary} />
      {typeof badge === 'number' && badge > 0 && (
        <Animated.View style={[styles.badge, glow(colors.danger, 0.75, 8, 4)]}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </Animated.View>
      )}
    </AnimatedPressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    button: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.textPrimary, 0.08),
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badgeText: { color: '#FFFFFF', fontSize: scaleFont(10), fontWeight: '800' },
  });
