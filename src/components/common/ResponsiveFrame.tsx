import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

// Exported so anything rendered through a `Modal` — which portals straight to
// `document.body` on web (react-native-web's ModalPortal), outside this
// frame's own DOM subtree entirely — can still align itself to the frame's
// edges instead of the full browser viewport's.
export const MAX_APP_WIDTH = 480;
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

/**
 * The width the app's own content actually occupies on screen right now —
 * `MAX_APP_WIDTH` once the frame has kicked in, or `undefined` when there is
 * no frame (native, or a browser narrow enough to go edge-to-edge) and
 * nothing should be capped. A `Modal` escapes the frame's DOM subtree
 * entirely on web, so anything it renders needs this to align itself back to
 * the frame's edges instead of the full browser viewport's.
 */
export function useFramedContentWidth(): number | undefined {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < FRAME_BREAKPOINT) return undefined;
  return MAX_APP_WIDTH;
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
