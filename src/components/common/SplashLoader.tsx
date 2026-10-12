import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { fonts } from '../../theme/fonts';
import { scaleFont } from '../../theme/responsive';

// The logo: two linked wedding rings. The box is the size the native splash
// draws its icon at (app.json → expo-splash-screen → imageWidth), dead centre,
// and assets/splash-icon.png is these same rings at the same geometry, so the
// hand-over from the native splash shows no jump: the rings are already there.
const LOGO_SIZE = 140;
const RING = 64;
const RING_STROKE = 7;
// How far each ring's centre sits from the middle of the box.
const RING_OFFSET = 18;
// The "clink": the rings part by this much each, then knock back together.
const CLINK_GAP = 7;
const CLINK_PERIOD_MS = 1600;

// The shortest time the loader stays up, so the logo, name and dots get a
// proper moment on screen even when the app is ready almost at once. Past
// this, the loader leaves as soon as the app is ready.
const MIN_SHOW_MS = 5000;
const EXIT_MS = 320;
const DOT_COUNT = 3;
// One dot's hop, and the delay between neighbouring dots.
const DOT_HOP_MS = 300;
const DOT_STAGGER_MS = 150;

interface SplashLoaderProps {
  // Whether the app behind the loader is ready to be shown.
  ready: boolean;
  onFinish: () => void;
}

// Launch screen shown over the app while auth and onboarding state load: the
// linked-rings logo where the native splash left it, the app's name beneath, and
// three dots hopping in turn underneath until the app is ready, when the
// whole screen fades away.
export function SplashLoader({ ready, onFinish }: SplashLoaderProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const title = useSharedValue(0);
  const exit = useSharedValue(0);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    title.value = withDelay(reduceMotion ? 0 : 150, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt.current));
    const timer = setTimeout(() => {
      exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: (1 - title.value) * 10 }],
  }));

  const name = t('appName');

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.background }, screenStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel={name}
    >
      <Rings left={colors.brandMain} right={colors.metal} sparkle={colors.metalBright} still={reduceMotion} />

      <Animated.View style={[styles.below, titleStyle]} pointerEvents="none">
        <Text style={[styles.title, { color: colors.brandMain }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.dots}>
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <Dot key={i} index={i} color={colors.brandMain} still={reduceMotion} />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// Two linked rings that part a little and knock back together, with a glint
// of sparkles at each knock. The left ring's top half is drawn a second time
// over the right ring, so at the top the left passes in front and at the bottom
// behind: they read as linked rather than merely overlapping.
function Rings({ left, right, sparkle, still }: { left: string; right: string; sparkle: string; still: boolean }) {
  const gap = useSharedValue(0);
  const glint = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    gap.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
          withTiming(-0.15, { duration: 160, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: CLINK_PERIOD_MS - 520 })
        ),
        -1,
        false
      )
    );
    // The sparkles flash just as the rings meet.
    glint.value = withDelay(
      300 + 380,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: CLINK_PERIOD_MS - 600 })
        ),
        -1,
        false
      )
    );
    return () => {
      cancelAnimation(gap);
      cancelAnimation(glint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -gap.value * CLINK_GAP }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: gap.value * CLINK_GAP }] }));
  const glintStyle = useAnimatedStyle(() => ({
    opacity: glint.value,
    transform: [{ scale: 0.4 + glint.value * 0.6 }, { rotate: `${glint.value * 25}deg` }],
  }));

  const ring = (color: string) => <View style={[styles.ring, { borderColor: color }]} />;

  return (
    <View style={styles.logo}>
      <Animated.View style={[styles.ringSlot, { left: LOGO_SIZE / 2 - RING_OFFSET - RING / 2 }, leftStyle]}>
        {ring(left)}
      </Animated.View>
      <Animated.View style={[styles.ringSlot, { left: LOGO_SIZE / 2 + RING_OFFSET - RING / 2 }, rightStyle]}>
        {ring(right)}
      </Animated.View>
      <Animated.View
        style={[styles.ringSlot, styles.ringTopHalf, { left: LOGO_SIZE / 2 - RING_OFFSET - RING / 2 }, leftStyle]}
      >
        {ring(left)}
      </Animated.View>

      <Animated.View style={[styles.sparkleTop, glintStyle]} pointerEvents="none">
        <Ionicons name="sparkles" size={22} color={sparkle} />
      </Animated.View>
      <Animated.View style={[styles.sparkleSide, glintStyle]} pointerEvents="none">
        <Ionicons name="sparkles" size={14} color={sparkle} />
      </Animated.View>
    </View>
  );
}

// One loading dot: hops up and back, then waits for the others, so the three
// run as a wave.
function Dot({ index, color, still }: { index: number; color: string; still: boolean }) {
  const hop = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    hop.value = withDelay(
      index * DOT_STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_HOP_MS, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: DOT_HOP_MS, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: DOT_STAGGER_MS * (DOT_COUNT - 1) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(hop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + hop.value * 0.65,
    transform: [{ translateY: -hop.value * 8 }],
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  screen: { zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  ringSlot: { position: 'absolute', top: LOGO_SIZE / 2 - RING / 2, width: RING, height: RING },
  // Clips the second copy of the left ring to its top half.
  ringTopHalf: { height: RING / 2, overflow: 'hidden' },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: RING_STROKE },
  sparkleTop: { position: 'absolute', left: LOGO_SIZE / 2 - 11, top: LOGO_SIZE / 2 - RING / 2 - 30 },
  sparkleSide: { position: 'absolute', left: LOGO_SIZE / 2 + RING_OFFSET + RING / 2 - 4, top: LOGO_SIZE / 2 - RING / 2 - 6 },
  // Below the rings without moving them: the logo stays dead centre, where the
  // native splash put it.
  below: {
    position: 'absolute',
    top: '50%',
    marginTop: LOGO_SIZE / 2 + 16,
    alignItems: 'center',
    left: 24,
    right: 24,
  },
  title: { fontFamily: fonts.display, fontSize: scaleFont(28), textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 28, height: 20, alignItems: 'flex-end' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
