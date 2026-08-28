import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface HomeTopBarProps {
  // Number of active browse filters — shown as a count on the Filters chip.
  activeFilterCount: number;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onBoost: () => void;
  // Fills the boost chip while a boost is running.
  boostActive: boolean;
  notificationCount: number;
  onNotifications: () => void;
}

// Browse header, one row deep so the photo below it gets the screen: the deck
// controls lead, boost and notifications trail. Labelled chips rather than bare
// icons keep the bar readable in Urdu, where an icon alone carries no meaning.
export function HomeTopBar({
  activeFilterCount,
  onOpenFilters,
  onOpenSort,
  onBoost,
  boostActive,
  notificationCount,
  onNotifications,
}: HomeTopBarProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, rtl && styles.rowRtl]}>
      <Pressable onPress={onOpenFilters} style={[styles.chip, activeFilterCount > 0 && styles.chipActive]}>
        <Ionicons
          name="options-outline"
          size={16}
          color={activeFilterCount > 0 ? colors.teal : colors.textSecondary}
        />
        <Text style={[styles.chipLabel, activeFilterCount > 0 && styles.chipLabelActive]}>
          {t('discover.filters')}
        </Text>
        {activeFilterCount > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>

      <Pressable onPress={onOpenSort} style={styles.chip}>
        <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
        <Text style={styles.chipLabel}>{t('discover.sort')}</Text>
      </Pressable>

      <View style={styles.spacer} />

      <Pressable onPress={onBoost} hitSlop={6} style={[styles.boostChip, boostActive && styles.boostChipActive]}>
        <Ionicons name="rocket" size={15} color={boostActive ? '#FFFFFF' : colors.gold} />
        <Text style={[styles.boostLabel, boostActive && styles.boostLabelActive]}>{t('boost.title')}</Text>
      </Pressable>

      <Pressable onPress={onNotifications} hitSlop={8} style={styles.bellButton}>
        <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
        {notificationCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
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
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: colors.gold,
      backgroundColor: colors.goldSoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    boostChipActive: { backgroundColor: colors.gold },
    boostLabel: { ...typography.caption, color: colors.gold, fontWeight: '800' },
    boostLabelActive: { color: '#FFFFFF' },
    bellButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipActive: { backgroundColor: colors.tealSoft },
    chipLabel: { ...typography.label, color: colors.textSecondary, fontWeight: '700' },
    chipLabelActive: { color: colors.teal },
    countPill: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countPillText: { color: '#FFFFFF', fontSize: scaleFont(10), fontWeight: '800' },
    badge: {
      position: 'absolute',
      top: 2,
      right: 0,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: colors.dating,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    badgeText: { color: '#FFFFFF', fontSize: scaleFont(9), fontWeight: '800' },
  });
