import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface SwipeableCardProps {
  // Changing this resets the card to centre for the next profile.
  profileId: string;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  children: React.ReactNode;
}

// Distance past which a drag counts as a decision, and the flick speed that
// counts even on a short drag.
const DECISION_RATIO = 0.28;
const FLICK_VELOCITY = 800;

// Drag-to-decide on the profile card: right likes, left passes. The gesture only
// claims horizontal movement, so the profile below it still scrolls vertically.
export function SwipeableCard({ profileId, onSwipeRight, onSwipeLeft, children }: SwipeableCardProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const threshold = width * DECISION_RATIO;

  const x = useSharedValue(0);
  const settled = useSharedValue(0);

  const finish = (direction: 'left' | 'right') => {
    if (direction === 'right') onSwipeRight();
    else onSwipeLeft();
  };

  // A new profile arrives centred, whatever the last card did.
  React.useEffect(() => {
    x.value = 0;
    settled.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const pan = Gesture.Pan()
    // Horizontal intent only — vertical drags belong to the scroll view.
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      if (settled.value) return;
      x.value = e.translationX;
    })
    .onEnd((e) => {
      if (settled.value) return;
      const decided = Math.abs(e.translationX) > threshold || Math.abs(e.velocityX) > FLICK_VELOCITY;
      if (!decided) {
        x.value = withSpring(0, { damping: 18, stiffness: 220 });
        return;
      }
      const direction = e.translationX > 0 ? 'right' : 'left';
      settled.value = 1;
      x.value = withTiming(direction === 'right' ? width * 1.4 : -width * 1.4, { duration: 180 }, () => {
        runOnJS(finish)(direction);
      });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-10, 0, 10])}deg` },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, threshold], [0, 1], 'clamp'),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-threshold, 0], [1, 0], 'clamp'),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={cardStyle}>
        {children}

        <Animated.View style={[styles.stamp, styles.stampLike, likeStyle]} pointerEvents="none">
          <Ionicons name="heart" size={16} color={colors.dating} />
          <Text style={[styles.stampText, { color: colors.dating }]}>{t('discover.swipeHintLike')}</Text>
        </Animated.View>

        <Animated.View style={[styles.stamp, styles.stampPass, passStyle]} pointerEvents="none">
          <Ionicons name="close" size={16} color={colors.textSecondary} />
          <Text style={[styles.stampText, { color: colors.textSecondary }]}>{t('discover.swipeHintPass')}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    stamp: {
      position: 'absolute',
      top: spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    stampLike: { right: spacing.xl, borderColor: colors.dating, transform: [{ rotate: '-8deg' }] },
    stampPass: { left: spacing.xl, borderColor: colors.border, transform: [{ rotate: '8deg' }] },
    stampText: { ...typography.label, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  });
