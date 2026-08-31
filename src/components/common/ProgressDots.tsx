import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing } from '../../theme';
import { glow } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

export function ProgressDots({ total, current }: { total: number; current: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => {
        // The step you are on is lit; the ones behind you are a solid, calmer
        // green so progress reads as a filling bar rather than a row of dots.
        if (index === current) {
          return (
            <LinearGradient
              key={index}
              colors={[colors.teal, colors.sage]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.dot, glow(colors.teal, 0.7, 8, 4)]}
            />
          );
        }
        return <View key={index} style={[styles.dot, index < current && styles.dotDone]} />;
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginBottom: spacing.lg },
    dot: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
      marginRight: spacing.xs,
    },
    dotDone: { backgroundColor: colors.sage },
  });
