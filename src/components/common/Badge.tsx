import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface BadgeProps {
  label: string;
  tone?: 'success' | 'neutral' | 'locked' | 'dating' | 'rishta' | 'danger' | 'premium';
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const palette = {
    success: { bg: colors.successSoft, fg: colors.success },
    neutral: { bg: colors.border, fg: colors.textSecondary },
    locked: { bg: colors.plumLight, fg: colors.plum },
    dating: { bg: colors.datingSoft, fg: colors.dating },
    rishta: { bg: colors.rishtaSoft, fg: colors.rishta },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    premium: { bg: colors.goldSoft, fg: colors.gold },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon && <Ionicons name={icon} size={11} color={palette.fg} style={styles.icon} />}
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    icon: { marginRight: 3 },
    text: { ...typography.caption, fontWeight: '600' },
  });
