import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';

// iOS HIG / Material minimum comfortable touch target, regardless of device scale.
const MIN_TOUCH_TARGET = 48;
import { useTheme } from '../../store/ThemeContext';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, icon }: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 14, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.teal} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              variant === 'primary' && styles.labelPrimary,
              variant === 'secondary' && styles.labelSecondary,
              variant === 'ghost' && styles.labelGhost,
              variant === 'danger' && styles.labelDanger,
              icon ? { marginLeft: spacing.xs } : null,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    base: {
      minHeight: Math.max(MIN_TOUCH_TARGET, scaleSpace(52)),
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
    },
    primary: { backgroundColor: colors.teal },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.teal,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: {
      backgroundColor: colors.dangerSoft,
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    disabled: { opacity: 0.5 },
    label: { ...typography.bodyBold },
    labelPrimary: { color: colors.textInverse },
    labelSecondary: { color: colors.teal },
    labelGhost: { color: colors.teal },
    labelDanger: { color: colors.danger },
  });
