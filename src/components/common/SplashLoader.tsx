import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { withAlpha } from '../../theme/glow';
import { fonts } from '../../theme/fonts';
import { scaleFont } from '../../theme/responsive';

// The badge: the app's logo mark in its own pink on a white disc (the mark on
// its own is assets/logo-mark.png). The native splash draws this same image at
// this size (app.json → expo-splash-screen → imageWidth), dead centre on the
// same pink, so the hand-over shows no jump.
const BADGE = require('../../../assets/splash-icon.png');
const BADGE_SIZE = 140;

// The shortest time the loader stays up, so the brand screen gets a proper
// moment even when the app is ready almost at once. Past this, the loader
// leaves as soon as the app is ready.
const MIN_SHOW_MS = 4000;
const EXIT_MS = 420;

// Rings spreading out from behind the badge, one after another.
const RIPPLE_COUNT = 3;
const RIPPLE_MS = 2400;

// The three loading dots: one dot's hop, and the delay between neighbours, so
// they rise one after another as a wave.
const DOT_COUNT = 3;
const DOT_SIZE = 12;
const DOT_HOP_MS = 320;
const DOT_STAGGER_MS = 170;

// The hearts floating along the top of the screen: where each sits (0 to 1
// across the width and down the height), its size, and how long one gentle
// bob up and down takes.
const FLOATERS = [
  { x: 0.14, y: 0.07, size: 30, duration: 2600 },
  { x: 0.38, y: 0.03, size: 18, duration: 2200 },
  { x: 0.62, y: 0.09, size: 36, duration: 3000 },
  { x: 0.87, y: 0.05, size: 22, duration: 2400 },
  { x: 0.27, y: 0.16, size: 13, duration: 2000 },
  { x: 0.77, y: 0.18, size: 15, duration: 2800 },
];

interface SplashLoaderProps {
  // Whether the app behind the loader is ready to be shown.
  ready: boolean;
  onFinish: () => void;
}

// Launch screen shown over the app while auth and onboarding state load, in
// the theme's brand colour: the logo badge in the middle with rings spreading
// out behind it, the app's name, a short line and tagline beneath, three dots
// hopping in turn, and soft hearts floating along the top. When the app is
// ready the badge swells and the screen fades away.
export function SplashLoader({ ready, onFinish }: SplashLoaderProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const breathe = useSharedValue(0);
  // Beneath the badge, in order: the name rises in, the line draws out from
  // the middle, then the tagline follows.
  const title = useSharedValue(reduceMotion ? 1 : 0);
  const rule = useSharedValue(reduceMotion ? 1 : 0);
  const tagline = useSharedValue(reduceMotion ? 1 : 0);
  const exit = useSharedValue(0);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    if (reduceMotion) return;
    title.value = withDelay(150, withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }));
    rule.value = withDelay(550, withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }));
    tagline.value = withDelay(850, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    breathe.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breathe);
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
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + breathe.value * 0.035) * (1 + exit.value * 0.25) }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: (1 - title.value) * 12 }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({ opacity: rule.value, transform: [{ scaleX: rule.value }] }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * 8 }],
  }));

  const name = t('appName');

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.brandMain }, screenStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel={name}
    >
      {!reduceMotion && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {FLOATERS.map((f, i) => (
            <FloatingHeart key={i} {...f} index={i} />
          ))}
        </View>
      )}

      {!reduceMotion && Array.from({ length: RIPPLE_COUNT }, (_, i) => <Ripple key={i} index={i} />)}

      <Animated.View style={[styles.badgeShadow, badgeStyle]}>
        <Image source={BADGE} style={styles.badge} />
      </Animated.View>

      <View style={styles.below} pointerEvents="none">
        <Animated.Text style={[styles.title, titleStyle]} numberOfLines={1} adjustsFontSizeToFit>
          {name}
        </Animated.Text>
        <Animated.View style={[styles.rule, ruleStyle]} />
        <Animated.Text style={[styles.tagline, taglineStyle]} numberOfLines={1}>
          {t('loader.tagline')}
        </Animated.Text>
        <View style={styles.dots}>
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <Dot key={i} index={i} still={reduceMotion} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// One ring spreading out from behind the badge and fading as it goes. The
// rings start a third of a cycle apart, so one is always on its way out.
function Ripple({ index }: { index: number }) {
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = withDelay(
      (RIPPLE_MS / RIPPLE_COUNT) * index,
      withRepeat(withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) }), -1, false)
    );
    return () => cancelAnimation(grow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: (1 - grow.value) * 0.5,
    transform: [{ scale: 1 + grow.value * 0.9 }],
  }));

  return <Animated.View style={[styles.ripple, style]} pointerEvents="none" />;
}

// One loading dot: hops up and back, then waits for the others.
function Dot({ index, still }: { index: number; still: boolean }) {
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
    opacity: 0.45 + hop.value * 0.55,
    transform: [{ translateY: -hop.value * 10 }, { scale: 1 + hop.value * 0.15 }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

// One soft heart near the top of the screen, bobbing up and down and tilting a
// little. Neighbours start at different points of the bob so they never move
// in step.
function FloatingHeart({
  x,
  y,
  size,
  duration,
  index,
}: {
  x: number;
  y: number;
  size: number;
  duration: number;
  index: number;
}) {
  const { width, height } = useWindowDimensions();
  const bob = useSharedValue(0);
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(index * 120, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    bob.value = withDelay(
      index * 250,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
    return () => cancelAnimation(bob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateY: (1 - appear.value) * -20 + (bob.value - 0.5) * 14 },
      { rotate: `${(bob.value - 0.5) * (index % 2 === 0 ? 16 : -16)}deg` },
      { scale: 0.6 + appear.value * 0.4 },
    ],
  }));

  return (
    <Animated.View style={[styles.floater, { left: x * width - size / 2, top: y * height }, style]}>
      <Ionicons name="heart" size={size} color={withAlpha('#FFFFFF', 0.3)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  // A soft shadow lifts the white badge off the pink.
  badgeShadow: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    backgroundColor: '#FFFFFF',
  },
  badge: { width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: BADGE_SIZE / 2 },
  ripple: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  // Everything under the badge is placed from the screen's centre, so the
  // badge itself stays dead centre, where the native splash put it.
  below: {
    position: 'absolute',
    top: '50%',
    marginTop: BADGE_SIZE / 2 + 26,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: scaleFont(30),
    color: '#FFFFFF',
    textAlign: 'center',
  },
  rule: { width: 56, height: 2, borderRadius: 1, marginTop: 12, backgroundColor: withAlpha('#FFFFFF', 0.7) },
  tagline: {
    marginTop: 10,
    fontFamily: fonts.bodyBold,
    fontSize: scaleFont(13),
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: withAlpha('#FFFFFF', 0.85),
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 30, height: DOT_SIZE + 12 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: '#FFFFFF' },
  floater: { position: 'absolute' },
});
