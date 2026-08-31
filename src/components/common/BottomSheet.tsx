import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing } from '../../theme';
import { useTheme } from '../../store/ThemeContext';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // Cap on how much of the screen the panel may take.
  maxHeight?: ViewStyle['maxHeight'];
  height?: ViewStyle['height'];
  // Hides the grab handle for panels that draw their own header.
  showHandle?: boolean;
}

// Open and close are driven by one shared value rather than the Modal's own
// animation plus a layout animation on top of it — two animations fighting each
// other is what made these panels stutter on Android. Timing (not spring) keeps
// the curve identical on every device, and the modal stays mounted until the
// close animation has actually finished.
const OPEN = { duration: 260, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 190, easing: Easing.in(Easing.cubic) };
// Used until the panel has been measured, so the first frame starts off-screen.
const FALLBACK_TRAVEL = 600;

export function BottomSheet({ visible, onClose, children, maxHeight = '88%', height, showHandle = true }: BottomSheetProps) {
  const { colors } = useTheme();
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    progress.value = withTiming(0, CLOSE, (finished) => {
      if (finished) runOnJS(setRendered)(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Runs once the Modal has actually mounted its children, so the panel never
  // flashes at its final position before sliding.
  useEffect(() => {
    if (rendered && visible) progress.value = withTiming(1, OPEN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, visible]);

  const onSheetLayout = (e: LayoutChangeEvent) => {
    sheetHeight.value = e.nativeEvent.layout.height;
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * (sheetHeight.value || FALLBACK_TRAVEL) }],
  }));

  return (
    <Modal
      visible={rendered}
      transparent
      // The slide is ours; letting the Modal animate too is what caused the jank.
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated, maxHeight, height },
            sheetStyle,
          ]}
        >
          {/* A hairline of brand colour along the panel's lip, so a sheet reads
              as part of the app rather than as a bare system tray. */}
          <LinearGradient
            colors={[colors.teal, colors.plum, colors.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topRule}
          />
          {showHandle && <View style={[styles.handle, { backgroundColor: colors.border }]} />}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  topRule: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 2,
    marginBottom: spacing.sm,
  },
});
