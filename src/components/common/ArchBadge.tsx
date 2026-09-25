import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme';
import { withAlpha } from '../../theme/glow';
import { scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

interface ArchBadgeProps {
  icon: IconName;
  // 'rose' for a step in progress, 'success' once something is done.
  tone?: 'rose' | 'success';
  style?: ViewStyle;
}

// A small icon framed in the design system's Mughal arch: a blush (or pale
// emerald) mihrab with a gold hairline, used to head a form step.
export function ArchBadge({ icon, tone = 'rose', style }: ArchBadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const success = tone === 'success';

  return (
    <View style={[styles.arch, success && styles.archSuccess, style]}>
      <View style={styles.disc}>
        <Ionicons name={icon} size={26} color={success ? colors.success : colors.teal} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    arch: {
      alignSelf: 'center',
      width: scaleSpace(88),
      height: scaleSpace(104),
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: scaleSpace(12),
      backgroundColor: colors.tealSoft,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.6),
      // Oversized radius is clamped to half the width: a full arched crest.
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
    },
    archSuccess: { backgroundColor: colors.successSoft, borderColor: withAlpha(colors.success, 0.4) },
    disc: {
      width: scaleSpace(52),
      height: scaleSpace(52),
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
  });
