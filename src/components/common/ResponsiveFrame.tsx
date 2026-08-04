import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

const MAX_APP_WIDTH = 480;
// Below this browser width the "phone in a frame" look would waste space —
// treat it as a real mobile viewport and go edge-to-edge instead.
const FRAME_BREAKPOINT = 560;

export function ResponsiveFrame({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (Platform.OS !== 'web' || width < FRAME_BREAKPOINT) {
    return <>{children}</>;
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundAlt,
    },
    frame: {
      flex: 1,
      width: '100%',
      maxWidth: MAX_APP_WIDTH,
      height: '100%',
      maxHeight: 900,
      overflow: 'hidden',
      backgroundColor: colors.background,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 1,
      shadowRadius: 40,
      shadowOffset: { width: 0, height: 20 },
      elevation: 10,
    },
  });
