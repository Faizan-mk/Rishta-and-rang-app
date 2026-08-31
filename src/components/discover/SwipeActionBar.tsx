import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha, type Gradient } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import type { ProfileMode } from '../../types/user';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface SwipeActionBarProps {
  canUndo: boolean;
  liked: boolean;
  // Rewind is an Explore+ feature — a locked button still responds, it just
  // opens the upgrade prompt instead of acting.
  locked: boolean;
  onUndo: () => void;
  onPass: () => void;
  onLike: () => void;
  // Extra bottom offset so the dock floats above the app's tab bar.
  bottomInset: number;
  // Tints the like button with the deck being browsed.
  mode: ProfileMode;
}

// One floating dock holding the three deck actions, labelled so the meaning is
// obvious in every language rather than relying on icon convention alone. Like
// is the lit one — it's the decision the whole screen is built around.
export function SwipeActionBar({ canUndo, liked, locked, onUndo, onPass, onLike, bottomInset, mode }: SwipeActionBarProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const accent = modeAccent(colors, mode);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, { bottom: bottomInset }]} pointerEvents="box-none">
      <View style={[styles.dock, glow(accent.primary, 0.35, 22, 10)]}>
        <DockButton
          label={t('discover.pass')}
          icon="close"
          tint={colors.textSecondary}
          onPress={onPass}
          colors={colors}
        />
        <View style={styles.divider} />
        <DockButton
          label={t('discover.rewind')}
          icon="arrow-undo"
          tint={colors.gold}
          onPress={onUndo}
          disabled={!canUndo}
          locked={canUndo && locked}
          colors={colors}
        />
        <View style={styles.divider} />
        <DockButton
          label={t('discover.like')}
          icon={liked ? 'heart' : 'heart-outline'}
          tint={accent.primary}
          gradient={accent.ramp}
          onPress={onLike}
          colors={colors}
          primary
          pulsing={!liked}
        />
      </View>
    </View>
  );
}

function DockButton({
  label,
  icon,
  tint,
  gradient,
  onPress,
  colors,
  disabled,
  locked,
  primary,
  pulsing,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  gradient?: Gradient;
  onPress: () => void;
  colors: Palette;
  disabled?: boolean;
  locked?: boolean;
  primary?: boolean;
  // Breathes a halo behind the button while the action is still open.
  pulsing?: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (!pulsing) {
      halo.value = withTiming(0, { duration: 250 });
      return;
    }
    halo.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulsing, halo]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + halo.value * 0.35 }],
    opacity: 0.45 - halo.value * 0.35,
  }));

  return (
    <Animated.View style={[styles.buttonWrap, animatedStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          if (disabled) return;
          scale.value = withSpring(0.92, { damping: 14, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10, stiffness: 220 });
        }}
        style={[styles.button, disabled && styles.disabled]}
      >
        <View style={styles.iconSlot}>
          {primary && (
            <Animated.View
              pointerEvents="none"
              style={[styles.iconHalo, { backgroundColor: withAlpha(tint, 0.9) }, haloStyle]}
            />
          )}

          {primary && gradient ? (
            <LinearGradient
              colors={gradient}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={[styles.iconCircle, styles.iconCirclePrimary, glow(tint, 0.7, 14, 8)]}
            >
              <Ionicons name={icon} size={25} color="#FFFFFF" />
            </LinearGradient>
          ) : (
            <View style={styles.iconCircle}>
              <Ionicons name={icon} size={21} color={tint} />
              {locked && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={8} color="#FFFFFF" />
                </View>
              )}
            </View>
          )}
        </View>

        <Text style={[styles.buttonLabel, { color: primary ? tint : colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing.xs },
    dock: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
    buttonWrap: { minWidth: 92 },
    button: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    disabled: { opacity: 0.4 },
    iconSlot: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    iconHalo: { position: 'absolute', width: 46, height: 46, borderRadius: 23 },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCirclePrimary: { width: 48, height: 48, borderRadius: 24 },
    lockBadge: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.gold,
      borderWidth: 2,
      borderColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonLabel: { ...typography.caption, fontWeight: '800' },
  });
