import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface CalendarModalProps {
  visible: boolean;
  initialIso?: string | null;
  maxDateIso: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

const WEEKDAY_KEYS = [
  'calendar.weekdaySun',
  'calendar.weekdayMon',
  'calendar.weekdayTue',
  'calendar.weekdayWed',
  'calendar.weekdayThu',
  'calendar.weekdayFri',
  'calendar.weekdaySat',
] as const;
const CELL_SIZE = 40;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function CalendarModal({ visible, initialIso, maxDateIso, onSelect, onClose }: CalendarModalProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxDate = useMemo(() => new Date(maxDateIso), [maxDateIso]);

  const seed = initialIso ? new Date(initialIso) : maxDate;
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());
  const [yearPicker, setYearPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const next = initialIso ? new Date(initialIso) : maxDate;
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setYearPicker(false);
    // Re-seed only when the sheet opens, not on every keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Years run from the current birth-year ceiling (18+) back a full lifetime,
  // so someone born in the 1940s is still reachable without tapping back forever.
  const maxYear = maxDate.getFullYear();
  const minYear = maxYear - 90;
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [minYear, maxYear]
  );

  const selectYear = (year: number) => {
    setViewYear(year);
    setYearPicker(false);
  };

  // Tapping the year (never the month) opens the dropdown; the month stays on
  // the chevrons so the two navigation gestures don't fight.
  const onHeaderPress = () => setYearPicker((v) => !v);

  const listRef = useRef<ScrollView>(null);
  const yearRowHeight = 44;
  useEffect(() => {
    if (!yearPicker) return;
    const index = Math.max(0, years.indexOf(viewYear));
    listRef.current?.scrollTo({ y: index * yearRowHeight, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearPicker]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  // Built from the dictionary rather than toLocaleDateString: Hermes ships a
  // trimmed ICU, so a locale-formatted month silently falls back to English.
  const monthLabel = t('calendar.label', { month: t(`calendar.month${viewMonth}`), year: viewYear });
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(500).springify().damping(22).stiffness(120)} style={styles.sheet}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.header}>
              <Pressable onPress={goPrev} style={styles.navButton} hitSlop={8}>
                <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.textPrimary} />
              </Pressable>
              <Pressable onPress={onHeaderPress} style={styles.monthLabelWrap} hitSlop={8}>
                <Text style={styles.monthLabel}>{monthLabel}</Text>
                <Ionicons
                  name={rtl ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.teal}
                  style={{ transform: [{ rotate: yearPicker ? (rtl ? '-180deg' : '180deg') : '0deg' }] }}
                />
              </Pressable>
              <Pressable onPress={goNext} disabled={!canGoNext} style={styles.navButton} hitSlop={8}>
                <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={canGoNext ? colors.textPrimary : colors.textTertiary} />
              </Pressable>
            </View>

            {yearPicker ? (
              <View style={styles.yearPanel}>
                <ScrollView
                  ref={listRef}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.yearList}
                >
                  {years.map((year) => {
                    const selected = year === viewYear;
                    return (
                      <Pressable
                        key={year}
                        onPress={() => selectYear(year)}
                        style={[styles.yearRow, selected && styles.yearRowSelected]}
                      >
                        <Text style={[styles.yearText, selected && styles.yearTextSelected]}>{year}</Text>
                        {selected && <Ionicons name="checkmark" size={16} color={colors.teal} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <>
                <View style={styles.weekRow}>
                  {WEEKDAY_KEYS.map((key, index) => (
                    <Text key={`${key}-${index}`} style={styles.weekday}>{t(key)}</Text>
                  ))}
                </View>

                <View style={styles.grid}>
                  {cells.map((day, index) => {
                    if (day === null) return <View key={`empty-${index}`} style={styles.cell} />;
                    const iso = toIso(viewYear, viewMonth, day);
                    const disabled = new Date(viewYear, viewMonth, day) > maxDate;
                    const isSelected = initialIso === iso;
                    return (
                      <Pressable
                        key={day}
                        disabled={disabled}
                        onPress={() => onSelect(iso)}
                        style={[styles.cell, isSelected && styles.cellSelected]}
                      >
                        <Text style={[styles.cellText, disabled && styles.cellTextDisabled, isSelected && styles.cellTextSelected]}>
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.lg,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    navButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    monthLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    monthLabel: { ...typography.h3, color: colors.textPrimary },
    yearPanel: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.backgroundAlt,
      overflow: 'hidden',
      marginBottom: spacing.md,
      maxHeight: 260,
    },
    yearList: { paddingVertical: spacing.xs },
    yearRow: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
    },
    yearRowSelected: { backgroundColor: withAlpha(colors.teal, 0.08) },
    yearText: { ...typography.body, color: colors.textPrimary },
    yearTextSelected: { color: colors.teal, fontWeight: '800' },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    weekday: { ...typography.caption, color: colors.textTertiary, width: CELL_SIZE, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: CELL_SIZE / 2 },
    cellSelected: { backgroundColor: colors.teal },
    cellText: { ...typography.body, color: colors.textPrimary },
    cellTextDisabled: { color: colors.textTertiary, opacity: 0.4 },
    cellTextSelected: { color: colors.textInverse, fontWeight: '700' },
  });
