import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { fonts, radius, spacing } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { APP_MODE, glow, modeAccent, withAlpha, type Gradient } from '../../theme/glow';

import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { BRAND_GOLD } from '../../utils/brandName';

interface HomeTopBarProps {
  // Number of active browse filters, shown as a count on the filters button.
  activeFilterCount: number;
  onOpenFilters: () => void;
  // Whether the filters sheet is currently open, so the button stays lit once
  // tapped.
  filtersOpen: boolean;
  // The sort sits in its own button beside Filters, lit while it isn't the
  // default order or while its sheet is open.
  sortActive: boolean;
  sortOpen: boolean;
  onOpenSort: () => void;
  notificationCount: number;
  onNotifications: () => void;
}

// Browse header: the app's name leads in its own colour, the sort, filters and
// notifications buttons trail as round icon buttons.
export function HomeTopBar({
  activeFilterCount,
  onOpenFilters,
  filtersOpen,
  sortActive,
  sortOpen,
  onOpenSort,
  notificationCount,
  onNotifications,
}: HomeTopBarProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const accent = modeAccent(colors, APP_MODE);
  const styles = useMemo(() => makeStyles(colors, accent.primary), [colors, accent.primary]);
  const filtersLit = activeFilterCount > 0 || filtersOpen;
  const sortLit = sortActive || sortOpen;

  return (
    <View style={[styles.wrap, rtl && styles.rowRtl]}>
      {/* Name and heart sit together as the wordmark. The block takes the
          free width, so the icons stay pinned to the far edge; at "Lovebirds"
          length the larger size and the heart keep that gap from reading as
          empty space. */}
      <View style={styles.brand}>
        <View style={[styles.brandRow, rtl && styles.rowRtl]}>
          <Text style={styles.title} numberOfLines={1}>
            {t('appName')}
          </Text>
          {/* Two hearts leaning into each other: the pair in the name. */}
          <View style={[styles.hearts, rtl ? styles.heartsRtl : styles.heartsLtr]} pointerEvents="none">
            <Ionicons name="heart" size={scaleFont(15)} color={accent.primary} style={styles.heartBack} />
            <Ionicons name="heart" size={scaleFont(12)} color={BRAND_GOLD} style={styles.heartFront} />
          </View>
        </View>
      </View>

      <Pressable
        onPress={onOpenSort}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('discover.sortBy')}
        style={({ pressed }) => [styles.iconButton, (sortLit || pressed) && styles.iconButtonActive]}
      >
        <Ionicons name="swap-vertical-outline" size={20} color={sortLit ? accent.primary : colors.textPrimary} />
        {sortActive && <View style={[styles.sortDot, glow(accent.primary, 0.7, 8, 4)]} pointerEvents="none" />}
      </Pressable>

      <Pressable
        onPress={onOpenFilters}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('discover.filters')}
        style={({ pressed }) => [styles.iconButton, (filtersLit || pressed) && styles.iconButtonActive]}
      >
        <Ionicons name="options-outline" size={20} color={filtersLit ? accent.primary : colors.textPrimary} />
        {activeFilterCount > 0 && (
          <View style={[styles.countPill, glow(accent.primary, 0.7, 8, 4)]} pointerEvents="none">
            <Text style={styles.countPillText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>

      <Pressable onPress={onNotifications} hitSlop={6} style={styles.iconButton}>
        <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
        {notificationCount > 0 && (
          <NotificationBadge count={notificationCount} tint={accent.primary} gradient={accent.duo} styles={styles} />
        )}
      </Pressable>
    </View>
  );
}

// The unread badge gets one attention-seeking beat every couple of seconds
// rather than a constant pulse — enough to catch the eye, not enough to nag.
function NotificationBadge({
  count,
  tint,
  gradient,
  styles,
}: {
  count: number;
  tint: string;
  gradient: Gradient;
  styles: ReturnType<typeof makeStyles>;
}) {
  const beat = useSharedValue(0);

  useEffect(() => {
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 2200 })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + beat.value * 0.28 }] }));

  return (
    <Animated.View style={[styles.badge, glow(tint, 0.8, 8, 5), style]} pointerEvents="none">
      <LinearGradient colors={gradient} start={GRADIENT_START} end={GRADIENT_END} style={styles.badgeFill}>
        <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

const makeStyles = (colors: Palette, accentColor: string) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      // Keep the header comfortably below the top safe area.
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    brand: { flex: 1 },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    hearts: { width: scaleFont(24), height: scaleFont(20), marginTop: -scaleFont(10) },
    heartsLtr: { marginLeft: 2 },
    heartsRtl: { marginRight: 2 },
    heartBack: { position: 'absolute', left: 0, top: 2, transform: [{ rotate: '-14deg' }] },
    heartFront: { position: 'absolute', left: scaleFont(10), top: 0, transform: [{ rotate: '16deg' }] },
    title: {
      flexShrink: 1,
      fontFamily: fonts.display,
      fontSize: scaleFont(30),
      // The whole name in the app colour; Home keeps the wordmark one tone.
      color: accentColor,
    },
    // Round icon button: a white disc with a hairline, lit in the accent while
    // its sheet is open or filters are applied.
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconButtonActive: { backgroundColor: withAlpha(accentColor, 0.1), borderColor: accentColor },
    countPill: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: accentColor,
      borderWidth: 1.5,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countPillText: { color: '#FFFFFF', fontSize: scaleFont(9), fontFamily: fonts.bodyBold },
    // A dot rather than a count: a sort is one choice, not several.
    sortDot: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: accentColor,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor: colors.teal,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badgeFill: { flex: 1, minWidth: 14, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
    badgeText: { color: '#FFFFFF', fontSize: scaleFont(9), fontFamily: fonts.bodyBold },
  });
