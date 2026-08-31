import React, { useEffect, useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
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
import type { ProfileMode } from '../../types/user';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface ModeToggleProps {
  mode: ProfileMode;
  onChange: (mode: ProfileMode) => void;
  datingLabel: string;
  rishtaLabel: string;
  // Optional tallies shown beside each label — used where the two modes hold
  // separate lists (Matches) so a member can see what's waiting on the side
  // they're not looking at.
  datingCount?: number;
  rishtaCount?: number;
}

export function ModeToggle({ mode, onChange, datingLabel, rishtaLabel, datingCount, rishtaCount }: ModeToggleProps) {
  const { colors } = useTheme();
  const accent = modeAccent(colors, mode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const width = useSharedValue(0);
  const thumbX = useSharedValue(0);
  // Slow breathing halo behind the thumb, so the active side is alive rather
  // than merely filled.
  const halo = useSharedValue(0);

  useEffect(() => {
    // A snappier spring so the thumb lands with the tap rather than drifting
    // in afterwards — mode switches feel immediate instead of laggy.
    thumbX.value = withSpring(mode === 'dating' ? 0 : width.value / 2, { damping: 20, stiffness: 340 });
  }, [mode, width.value]);

  useEffect(() => {
    halo.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    thumbX.value = mode === 'dating' ? 0 : e.nativeEvent.layout.width / 2;
  };

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbX.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }, { scale: 1 + halo.value * 0.05 }],
    opacity: 0.35 + halo.value * 0.4,
  }));

  return (
    <View style={styles.track} onLayout={onTrackLayout}>
      <Animated.View
        pointerEvents="none"
        style={[styles.thumb, styles.halo, { backgroundColor: accent.primary }, glow(accent.primary, 0.9, 18, 0), haloStyle]}
      />
      <Animated.View style={[styles.thumb, thumbStyle]}>
        <LinearGradient colors={accent.ramp} start={GRADIENT_START} end={GRADIENT_END} style={styles.thumbFill} />
      </Animated.View>

      <ToggleOption
        active={mode === 'dating'}
        icon="sparkles"
        label={datingLabel}
        count={datingCount}
        onPress={() => onChange('dating')}
        colors={colors}
        styles={styles}
      />
      <ToggleOption
        active={mode === 'rishta'}
        icon="heart-circle"
        label={rishtaLabel}
        count={rishtaCount}
        onPress={() => onChange('rishta')}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

function ToggleOption({
  active,
  icon,
  label,
  count,
  onPress,
  colors,
  styles,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number;
  onPress: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const scale = useSharedValue(active ? 1 : 0.94);

  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.94, { damping: 18, stiffness: 340 });
  }, [active, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onPress} style={styles.option}>
      <Animated.View style={[styles.optionInner, style]}>
        <Ionicons name={icon} size={15} color={active ? colors.textInverse : colors.textTertiary} />
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
        {Boolean(count) && <Text style={[styles.count, active && styles.labelActive]}>{count}</Text>}
      </Animated.View>
    </Pressable>
  );
}

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 4,
      position: 'relative',
    },
    thumb: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      width: '50%',
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    // Sits under the thumb and breathes, painting colour past the pill's edge.
    halo: { overflow: 'visible' },
    thumbFill: { flex: 1 },
    option: { flex: 1, borderRadius: radius.pill },
    optionInner: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    label: { ...typography.bodyBold, color: colors.textSecondary },
    count: { ...typography.caption, color: colors.textTertiary },
    labelActive: { color: colors.textInverse },
  });
