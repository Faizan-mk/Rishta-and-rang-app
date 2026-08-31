import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../theme';
import { withAlpha } from '../theme/glow';
import type { Palette } from '../theme/palettes';
import { useTheme } from '../store/ThemeContext';
import { useLanguage } from '../store/LanguageContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

// In-screen header for routes that hide the navigator's own bar. The back
// chevron flips with the language, the way StepHeader's does.
export function Header({ title, subtitle, onBack, right }: HeaderProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.backButton} accessibilityRole="button">
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.textPrimary} />
        </Pressable>
      ) : null}

      <View style={styles.titles}>
        <Text style={[styles.title, rtl && styles.rtlText]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, rtl && styles.rtlText]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
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
    titles: { flex: 1, gap: 2 },
    title: { ...typography.h2, color: colors.textPrimary, fontWeight: '800' },
    subtitle: { ...typography.caption, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
