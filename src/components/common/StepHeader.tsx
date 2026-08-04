import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../theme';
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
    <View style={styles.row}>
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
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    dotsWrap: { flex: 1 },
  });
