import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
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

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_SIZE = 40;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function CalendarModal({ visible, initialIso, maxDateIso, onSelect, onClose }: CalendarModalProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxDate = useMemo(() => new Date(maxDateIso), [maxDateIso]);

  const seed = initialIso ? new Date(initialIso) : maxDate;
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  useEffect(() => {
    if (!visible) return;
    const next = initialIso ? new Date(initialIso) : maxDate;
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    // Re-seed only when the sheet opens, not on every keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(280).springify().damping(18)} style={styles.sheet}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.header}>
              <Pressable onPress={goPrev} style={styles.navButton} hitSlop={8}>
                <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.textPrimary} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable onPress={goNext} disabled={!canGoNext} style={styles.navButton} hitSlop={8}>
                <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={canGoNext ? colors.textPrimary : colors.textTertiary} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, index) => (
                <Text key={`${w}-${index}`} style={styles.weekday}>{w}</Text>
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
    monthLabel: { ...typography.h3, color: colors.textPrimary },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    weekday: { ...typography.caption, color: colors.textTertiary, width: CELL_SIZE, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: CELL_SIZE / 2 },
    cellSelected: { backgroundColor: colors.teal },
    cellText: { ...typography.body, color: colors.textPrimary },
    cellTextDisabled: { color: colors.textTertiary, opacity: 0.4 },
    cellTextSelected: { color: colors.textInverse, fontWeight: '700' },
  });
