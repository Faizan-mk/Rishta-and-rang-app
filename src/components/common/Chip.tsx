import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'dating' | 'rishta';
}

export function Chip({ label, selected, onPress, tone = 'neutral' }: ChipProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const toneColor = tone === 'dating' ? colors.dating : tone === 'rishta' ? colors.rishta : colors.teal;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: toneColor }, selected && { backgroundColor: toneColor }]}
    >
      <Text style={[styles.label, { color: selected ? colors.textInverse : toneColor }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    chip: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    label: { ...typography.label, flexShrink: 0 },
  });
