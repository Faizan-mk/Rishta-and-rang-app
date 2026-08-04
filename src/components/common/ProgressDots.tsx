import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

export function ProgressDots({ total, current }: { total: number; current: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index === current && styles.dotActive, index < current && styles.dotDone]}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginBottom: spacing.lg },
    dot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginRight: spacing.xs,
    },
    dotActive: { backgroundColor: colors.teal },
    dotDone: { backgroundColor: colors.sage },
  });
