import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { withAlpha } from '../../theme/glow';

const HEART = require('../../../assets/splash-icon.png');

// The two halves of the logo heart. Brand colours rather than palette tokens:
// they have to match the icon exactly in both themes.
const ORANGE = '#F39A2E';
const PINK = '#D6246B';

// splash-icon.png is a square canvas with the heart centred in it; the heart
// itself only covers the middle band. Mapping progress onto that band means 0%
// is an empty heart and 100% a full one, rather than filling blank padding.
const HEART_TOP = 0.124;
const HEART_BOTTOM = 0.876;

// No SVG or masking here, so the liquid surface is built from thin vertical
// slices of the heart image, each clipped to its own height. Offsetting those
// heights along a sine wave gives the wavy water line.
const SLICE_WIDTH = 4;
const SLICE_COUNT = 38;
const HEART_SIZE = SLICE_WIDTH * SLICE_COUNT;
const WAVE_AMPLITUDE = 6;
const WAVE_STEP = 0.32;

const JOIN_MS = 750;
const FILL_DELAY_MS = 900;
const FILL_MS = 2300;
const EXIT_MS = 550;

// Many barely-there rings blend into a smooth falloff; fewer, stronger ones
// read as visible bands.
const GLOW_RINGS = 18;
const GLOW_ALPHA = 0.014;

const TITLE_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

interface WaveSliceProps {
  index: number;
  progress: SharedValue<number>;
  phase: SharedValue<number>;
  amplitude: SharedValue<number>;
  // The back layer runs out of step with the front one, which gives the water
  // some depth instead of a single flat ribbon.
  phaseOffset: number;
}

function WaveSlice({ index, progress, phase, amplitude, phaseOffset }: WaveSliceProps) {
  const style = useAnimatedStyle(() => {
    const level = HEART_SIZE * (HEART_TOP + (HEART_BOTTOM - HEART_TOP) * progress.value);
    // Calm at 0% and 100%, liveliest half-way.
    const swell = amplitude.value * Math.sin(Math.PI * progress.value);
    const wave = swell * Math.sin(phase.value + phaseOffset + index * WAVE_STEP);
    return { height: Math.max(0, level + wave) };
  });

  return (
    <Animated.View style={[styles.slice, { left: index * SLICE_WIDTH }, style]}>
      <Image source={HEART} style={[styles.heartImage, { left: -index * SLICE_WIDTH }]} />
    </Animated.View>
  );
}

// One half of the heart, flying in from its own side.
function HeartHalf({ side, join }: { side: 'left' | 'right'; join: SharedValue<number> }) {
  const direction = side === 'left' ? -1 : 1;
  const style = useAnimatedStyle(() => ({
    // Once joined, a single whole image takes over (see JoinedGhost) so the
    // two clipped edges never leave a hairline seam down the middle.
    opacity: join.value >= 1 ? 0 : join.value,
    transform: [
      { translateX: (1 - join.value) * 130 * direction },
      { translateY: (1 - join.value) * -40 },
      { rotate: `${(1 - join.value) * 35 * direction}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.half, { left: side === 'left' ? 0 : HEART_SIZE / 2 }, style]}>
      <Image
        source={HEART}
        style={[styles.heartImage, styles.ghost, { left: side === 'left' ? 0 : -HEART_SIZE / 2 }]}
      />
    </Animated.View>
  );
}

function JoinedGhost({ join }: { join: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: join.value >= 1 ? 1 : 0 }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={HEART} style={[styles.heartImage, styles.ghost, { left: 0 }]} />
    </Animated.View>
  );
}

function TitleLetter({ char, index, total, start }: { char: string; index: number; total: number; start: SharedValue<number> }) {
  const appear = useSharedValue(0);

  useAnimatedReaction(
    () => start.value,
    (value, previous) => {
      if (value === 1 && previous !== 1) {
        appear.value = withDelay(index * 55, withTiming(1, { duration: 520, easing: Easing.out(Easing.back(2)) }));
      }
    }
  );

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, appear.value * 1.4),
    transform: [{ translateY: (1 - appear.value) * 22 }, { scale: 0.6 + appear.value * 0.4 }],
  }));

  return (
    <Animated.Text style={[styles.titleLetter, { color: mixHex(ORANGE, PINK, total > 1 ? index / (total - 1) : 0) }, style]}>
      {char}
    </Animated.Text>
  );
}

function GlowOrb({ color, size, x, y, drift }: { color: string; size: number; x: number; y: number; drift: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.value * size * 0.08 }, { translateY: drift.value * size * -0.06 }, { scale: 0.9 + drift.value * 0.2 }],
  }));
  // Stacked faint rings stand in for the radial gradient React Native lacks.
  const rings = useMemo(
    () =>
      Array.from({ length: GLOW_RINGS }, (_, i) => {
        const inset = (i / GLOW_RINGS) * (size / 2);
        const diameter = size - inset * 2;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: inset,
              top: inset,
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
              backgroundColor: withAlpha(color, GLOW_ALPHA),
            }}
          />
        );
      }),
    [color, size]
  );
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, top: y, width: size, height: size }, style]}>
      {rings}
    </Animated.View>
  );
}

interface SplashLoaderProps {
  // Whether the app behind the loader is ready to be shown. The fill always
  // runs to 100%; the loader then waits on this before leaving.
  ready: boolean;
  onFinish: () => void;
}

// Launch loader shown over the app while auth and onboarding state load. The
// two halves of the logo heart fly in and join, the heart fills with a liquid
// wave while a 0-100% counter runs, then it beats twice and zooms out of the
// way to reveal the app underneath.
export function SplashLoader({ ready, onFinish }: SplashLoaderProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();

  const join = useSharedValue(reduceMotion ? 1 : 0);
  const ripple = useSharedValue(0);
  const progress = useSharedValue(0);
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(reduceMotion ? 0 : WAVE_AMPLITUDE);
  const heartScale = useSharedValue(1);
  const halo = useSharedValue(0);
  const titleStart = useSharedValue(0);
  const drift = useSharedValue(0);
  const exit = useSharedValue(0);

  const [percent, setPercent] = useState(0);
  const [filled, setFilled] = useState(false);

  const title = t('appName');
  // Latin names stagger in letter by letter. Urdu letters join to their
  // neighbours, so pulling them apart would break the word; there it goes
  // word by word instead, laid out right to left.
  const latin = /^[\x20-\x7E]*$/.test(title);
  const pieces = useMemo(() => (latin ? Array.from(title) : title.split(' ')), [title, latin]);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
    join.value = withDelay(100, withTiming(1, { duration: JOIN_MS, easing: Easing.out(Easing.exp) }));
    ripple.value = withDelay(JOIN_MS - 50, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    titleStart.value = withDelay(reduceMotion ? 0 : 450, withTiming(1, { duration: 0 }));
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 1300, easing: Easing.linear }), -1, false);
    progress.value = withDelay(
      reduceMotion ? 0 : FILL_DELAY_MS,
      withTiming(
        1,
        { duration: reduceMotion ? 700 : FILL_MS, easing: Easing.bezier(0.45, 0.05, 0.35, 1) },
        (finished) => {
          if (finished) runOnJS(setFilled)(true);
        }
      )
    );
    return () => {
      cancelAnimation(drift);
      cancelAnimation(phase);
    };
  }, []);

  // Only crosses to the JS thread when the whole-number percentage changes.
  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (next, prev) => {
      if (next !== prev) runOnJS(setPercent)(next);
    }
  );

  useEffect(() => {
    if (!filled || !ready) return;
    const beat = withSequence(
      withTiming(1.15, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(0.97, { duration: 130 }),
      withTiming(1.1, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 190 })
    );
    heartScale.value = beat;
    halo.value = withSequence(withTiming(1, { duration: 260 }), withTiming(0, { duration: 400 }));
    exit.value = withDelay(
      650,
      withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      })
    );
  }, [filled, ready]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value * (1 + exit.value * exit.value * 5) }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.value > 0 ? 0.6 * (1 - ripple.value) : 0,
    transform: [{ scale: 0.5 + ripple.value * 1.6 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: halo.value * 0.9,
    transform: [{ scale: 0.8 + halo.value * 0.5 }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, exit.value * 2),
    transform: [{ translateY: exit.value * 30 }],
  }));
  const counterStyle = useAnimatedStyle(() => ({
    opacity: withTiming(join.value === 1 ? 1 : 0, { duration: 400 }),
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.background }, screenStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={[StyleSheet.absoluteFill, styles.field]} pointerEvents="none">
        <GlowOrb color={ORANGE} size={width * 1.1} x={-width * 0.55} y={-height * 0.12} drift={drift} />
        <GlowOrb color={PINK} size={width * 1.2} x={width * 0.35} y={height * 0.5} drift={drift} />
      </View>

      <View style={styles.stage}>
        <Animated.View style={[styles.ring, { borderColor: PINK }, rippleStyle]} />
        <Animated.View style={[styles.halo, { backgroundColor: withAlpha(PINK, 0.12) }, haloStyle]} />

        <Animated.View style={[styles.heart, heartStyle]}>
          <HeartHalf side="left" join={join} />
          <HeartHalf side="right" join={join} />
          <JoinedGhost join={join} />
          <View style={styles.backLayer} pointerEvents="none">
            {Array.from({ length: SLICE_COUNT }, (_, i) => (
              <WaveSlice key={`back-${i}`} index={i} progress={progress} phase={phase} amplitude={amplitude} phaseOffset={Math.PI} />
            ))}
          </View>
          {Array.from({ length: SLICE_COUNT }, (_, i) => (
            <WaveSlice key={`front-${i}`} index={i} progress={progress} phase={phase} amplitude={amplitude} phaseOffset={0} />
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.textBlock, contentStyle]}>
        <View style={[styles.titleRow, !latin && styles.titleRowRtl]}>
          {pieces.map((piece, i) => (
            <TitleLetter key={`${piece}-${i}`} char={piece} index={i} total={pieces.length} start={titleStart} />
          ))}
        </View>

        <Animated.View style={[styles.counterBlock, counterStyle]}>
          <View style={styles.counterRow}>
            <Text style={[styles.counter, { color: colors.textPrimary }]}>{percent}</Text>
            <Text style={[styles.counterUnit, { color: colors.gold }]}>%</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <Animated.View style={[styles.bar, barStyle]}>
              <LinearGradient colors={[ORANGE, PINK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.barGradient} />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const TRACK_WIDTH = 168;

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflow: 'hidden' },
  field: { overflow: 'hidden' },
  stage: { width: HEART_SIZE * 2, height: HEART_SIZE * 1.6, alignItems: 'center', justifyContent: 'center' },
  heart: { width: HEART_SIZE, height: HEART_SIZE },
  heartImage: { position: 'absolute', bottom: 0, width: HEART_SIZE, height: HEART_SIZE },
  ghost: { opacity: 0.16 },
  half: { position: 'absolute', top: 0, width: HEART_SIZE / 2, height: HEART_SIZE, overflow: 'hidden' },
  slice: { position: 'absolute', bottom: 0, width: SLICE_WIDTH, overflow: 'hidden' },
  backLayer: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  ring: {
    position: 'absolute',
    width: HEART_SIZE * 1.1,
    height: HEART_SIZE * 1.1,
    borderRadius: HEART_SIZE,
    borderWidth: 2,
  },
  halo: { position: 'absolute', width: HEART_SIZE * 1.3, height: HEART_SIZE * 1.3, borderRadius: HEART_SIZE },
  textBlock: { alignItems: 'center' },
  titleRow: { flexDirection: 'row' },
  titleRowRtl: { flexDirection: 'row-reverse', gap: 10 },
  titleLetter: { fontSize: 38, fontStyle: 'italic', fontFamily: TITLE_FONT, minWidth: 6 },
  counterBlock: { alignItems: 'center', marginTop: 22 },
  counterRow: { flexDirection: 'row', alignItems: 'flex-start' },
  counter: { fontSize: 44, fontWeight: '200', fontVariant: ['tabular-nums'], lineHeight: 50 },
  counterUnit: { fontSize: 16, fontWeight: '500', marginTop: 8, marginLeft: 3 },
  track: { width: TRACK_WIDTH, height: 3, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  bar: { height: 3, overflow: 'hidden' },
  barGradient: { width: TRACK_WIDTH, height: 3 },
});
