import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface BadgeProps {
  label: string;
  tone?: 'success' | 'neutral' | 'locked' | 'dating' | 'rishta' | 'danger';
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const palette = {
    success: { bg: colors.successSoft, fg: colors.success },
    neutral: { bg: colors.border, fg: colors.textSecondary },
    locked: { bg: colors.plumLight, fg: colors.plum },
    dating: { bg: colors.datingSoft, fg: colors.dating },
    rishta: { bg: colors.rishtaSoft, fg: colors.rishta },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    text: { ...typography.caption, fontWeight: '600' },
  });
