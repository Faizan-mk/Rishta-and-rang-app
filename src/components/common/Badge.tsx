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
      {/* One line, always. A pill that wraps stops being a pill: in a tight
          column (the chat header, where four icons and an avatar leave very
          little) "Moved to Rishta" broke in two and doubled the header's
          height. Narrow space now shortens the label instead of growing the
          badge. */}
      <Text style={[styles.text, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      // Hugs its label, but never spills past the column it sits in.
      maxWidth: '100%',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    icon: { marginRight: 3 },
    // `flexShrink` is what lets the ellipsis happen — without it the text keeps
    // its full width and pushes out of the pill instead of being trimmed.
    text: { ...typography.caption, fontWeight: '600', flexShrink: 1 },
  });
