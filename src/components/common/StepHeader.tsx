import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { ProgressDots } from './ProgressDots';

interface StepHeaderProps {
  total: number;
  current: number;
  onBack: () => void;
}

// Wraps ProgressDots with a back button so every step of a multi-step flow
// (signup, onboarding) can return to the previous step to correct something.
export function StepHeader({ total, current, onBack }: StepHeaderProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
        <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.dotsWrap}>
        <ProgressDots total={total} current={current} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // Mirrored in Urdu so the row starts from the edge the language does.
    rowRtl: { flexDirection: 'row-reverse' },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
    },
    dotsWrap: { flex: 1 },
  });
