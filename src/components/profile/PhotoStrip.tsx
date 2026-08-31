import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { radius, spacing } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

export function PhotoStrip({ photos }: { photos: string[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (photos.length === 0) {
    return <View style={styles.emptyPrimary} />;
  }

  return (
    <View>
      <Image source={{ uri: photos[0] }} style={styles.primary} />
      {photos.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll}>
          {photos.slice(1).map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    primary: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: radius.lg,
      backgroundColor: colors.skeleton,
      borderWidth: 2,
      borderColor: withAlpha(colors.teal, 0.35),
      ...glow(colors.teal, 0.2, 16, 6),
    },
    emptyPrimary: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: radius.lg,
      backgroundColor: colors.skeleton,
    },
    stripScroll: { marginTop: spacing.sm },
    thumb: {
      width: 66,
      height: 66,
      borderRadius: radius.md,
      marginRight: spacing.sm,
      backgroundColor: colors.skeleton,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
  });
