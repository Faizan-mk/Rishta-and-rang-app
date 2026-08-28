import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
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
}

// One floating dock holding the three deck actions, labelled so the meaning is
// obvious in every language rather than relying on icon convention alone.
export function SwipeActionBar({ canUndo, liked, locked, onUndo, onPass, onLike, bottomInset }: SwipeActionBarProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, { bottom: bottomInset }]} pointerEvents="box-none">
      <View style={styles.dock}>
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
          tint={liked ? colors.dating : colors.textSecondary}
          onPress={onLike}
          colors={colors}
          primary={liked}
        />
      </View>
    </View>
  );
}

function DockButton({
  label,
  icon,
  tint,
  onPress,
  colors,
  disabled,
  locked,
  primary,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
  colors: Palette;
  disabled?: boolean;
  locked?: boolean;
  primary?: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
        <View style={[styles.iconCircle, primary && { backgroundColor: tint }]}>
          <Ionicons name={icon} size={primary ? 24 : 21} color={primary ? '#FFFFFF' : tint} />
          {locked && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={8} color="#FFFFFF" />
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing.xs },
    dock: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
    buttonWrap: { minWidth: 92 },
    button: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    disabled: { opacity: 0.4 },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    buttonLabel: { ...typography.caption, fontWeight: '700' },
  });
