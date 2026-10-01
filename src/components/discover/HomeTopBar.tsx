import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, modeAccent, withAlpha, type Gradient } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import type { ProfileMode } from '../../types/user';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface HomeTopBarProps {
  // Number of active browse filters — shown as a count on the Filters chip.
  activeFilterCount: number;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  // Whether each chip's own sheet is currently open, so the chip stays lit
  // once tapped instead of only lighting up on hover (which touch has none of).
  filtersOpen: boolean;
  sortOpen: boolean;
  onBoost: () => void;
  // Fills the boost chip while a boost is running.
  boostActive: boolean;
  notificationCount: number;
  onNotifications: () => void;
  // Tints the bar's live accents with the deck the member is browsing.
  mode: ProfileMode;
}

// Browse header, one row deep so the photo below it gets the screen: the deck
// controls lead, boost and notifications trail. Labelled chips rather than bare
// icons keep the bar readable in Urdu, where an icon alone carries no meaning.
export function HomeTopBar({
  activeFilterCount,
  onOpenFilters,
  onOpenSort,
  filtersOpen,
  sortOpen,
  onBoost,
  boostActive,
  notificationCount,
  onNotifications,
  mode,
}: HomeTopBarProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const accent = modeAccent(colors, mode);
  // Filters/Sort borrow the deck's own accent (plum for Rishta, coral for
  // Friends) instead of a fixed teal, so the chips never clash with whichever
  // world the member is currently browsing.
  const styles = useMemo(() => makeStyles(colors, accent.primary), [colors, accent.primary]);
  const [filtersHovered, setFiltersHovered] = useState(false);
  const [sortHovered, setSortHovered] = useState(false);

  // "Lit" covers three distinct reasons: filters are actually applied, the
  // chip's own sheet is open (tapped state, persists after the press ends —
  // this is what makes a touch tap register visually, not just a mouse hover),
  // or the pointer is hovering/pressing it right now.
  const filtersLit = activeFilterCount > 0 || filtersOpen || filtersHovered;
  const sortLit = sortOpen || sortHovered;

  return (
    <View style={[styles.wrap, rtl && styles.rowRtl]}>
      <Pressable
        onPress={onOpenFilters}
        onHoverIn={() => setFiltersHovered(true)}
        onHoverOut={() => setFiltersHovered(false)}
        style={({ pressed }) => [
          styles.chip,
          (activeFilterCount > 0 || filtersOpen || filtersHovered || pressed) && styles.chipActive,
        ]}
      >
        <Ionicons name="options-outline" size={16} color={filtersLit ? accent.primary : colors.textSecondary} />
        <Text style={[styles.chipLabel, filtersLit && styles.chipLabelActive]}>{t('discover.filters')}</Text>
        {activeFilterCount > 0 && (
          <View style={[styles.countPill, glow(accent.primary, 0.7, 8, 4)]}>
            <Text style={styles.countPillText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={onOpenSort}
        onHoverIn={() => setSortHovered(true)}
        onHoverOut={() => setSortHovered(false)}
        style={({ pressed }) => [styles.chip, (sortOpen || sortHovered || pressed) && styles.chipActive]}
      >
        <Ionicons name="swap-vertical" size={16} color={sortLit ? accent.primary : colors.textSecondary} />
        <Text style={[styles.chipLabel, sortLit && styles.chipLabelActive]}>{t('discover.sort')}</Text>
      </Pressable>

      <View style={styles.spacer} />

      <BoostChip active={boostActive} label={t('boost.title')} onPress={onBoost} colors={colors} styles={styles} />

      <Pressable onPress={onNotifications} hitSlop={8} style={styles.bellButton}>
        <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
        {notificationCount > 0 && (
          <NotificationBadge count={notificationCount} tint={accent.primary} gradient={accent.duo} styles={styles} />
        )}
      </Pressable>
    </View>
  );
}

// Boost is the bar's one loud control: a gold-to-ember gradient, and while a
// boost is actually running it lifts and breathes so the member can tell the
// clock is ticking from anywhere on the deck.
function BoostChip({
  active,
  label,
  onPress,
  colors,
  styles,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [active, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.05 }],
    shadowOpacity: 0.35 + pulse.value * 0.5,
  }));

  const icon = <Ionicons name="rocket" size={15} color={active ? '#FFFFFF' : colors.gold} />;

  if (!active) {
    return (
      <Pressable onPress={onPress} hitSlop={6} style={styles.boostChip}>
        {icon}
        <Text style={styles.boostLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View style={[styles.boostGlow, glow(colors.gold, 0.6, 14, 8), style]}>
      <Pressable onPress={onPress} hitSlop={6}>
        <LinearGradient colors={BOOST_GRADIENT} start={GRADIENT_START} end={GRADIENT_END} style={styles.boostChipActive}>
          {icon}
          <Text style={[styles.boostLabel, styles.boostLabelActive]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
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
// Reads as "lit" against either theme, so it isn't a palette token.
const BOOST_GRADIENT = ['#D4A857', '#F2715E'] as const;

const makeStyles = (colors: Palette, accentColor: string) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      // Keep the browse actions comfortably below the top safe area.
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    spacer: { flex: 1 },
    boostChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.gold,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 7,
      shadowColor: '#2A1720',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    // Solid beneath the gradient: iOS derives a shadow from the layer's own
    // background, so a bare transparent wrapper would cast nothing.
    boostGlow: { borderRadius: radius.pill, backgroundColor: BOOST_GRADIENT[0] },
    boostChipActive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 7.5,
    },
    boostLabel: { ...typography.caption, color: colors.textPrimary, fontFamily: fonts.bodyBold },
    boostLabelActive: { color: '#FFFFFF' },
    // White floating disc, the same button shape as the screen back buttons.
    bellButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#2A1720',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      shadowColor: '#2A1720',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      // Hover/press just flips to chipActive's colors below — the web-only
      // transition is what makes that flip read as a fade instead of a snap.
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'background-color, border-color',
            transitionDuration: '160ms',
            transitionTimingFunction: 'ease',
          } as object)
        : null),
    },
    chipActive: { backgroundColor: withAlpha(accentColor, 0.1), borderColor: accentColor },
    chipLabel: { ...typography.label, color: colors.textSecondary },
    chipLabelActive: { color: accentColor },
    countPill: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: accentColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countPillText: { color: '#FFFFFF', fontSize: scaleFont(10), fontFamily: fonts.bodyBold },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor: colors.dating,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badgeFill: { flex: 1, minWidth: 14, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
    badgeText: { color: '#FFFFFF', fontSize: scaleFont(9), fontFamily: fonts.bodyBold },
  });
