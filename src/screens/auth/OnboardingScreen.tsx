import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { glow } from '../../theme/glow';
import { scaleFont, scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { useOnboardingGate } from '../../store/OnboardingGateContext';

const COUPLE_IMAGE = require('../../../assets/images/welcome-wedding.png');
const FRIENDS_IMAGE = require('../../../assets/images/onboarding-friends.png');

interface OnboardingPage {
  image: ImageSourcePropType;
  titleKey: string;
}

// Each page is a full-screen photo and one short line. The intro is meant to
// be glanced at, not read, so there are no subtitles.
const PAGES: OnboardingPage[] = [
  { image: COUPLE_IMAGE, titleKey: 'onboarding.page1.title' },
  { image: FRIENDS_IMAGE, titleKey: 'onboarding.page2.title' },
];

// Light at the top for Skip and the status bar, clear through the middle so
// the faces keep their light, and dark at the foot where the title sits.
const SCRIM_RAMP = [
  'rgba(36,31,33,0.35)',
  'rgba(36,31,33,0)',
  'rgba(36,31,33,0)',
  'rgba(36,31,33,0.85)',
] as const;
const SCRIM_STOPS = [0, 0.18, 0.5, 1] as const;
// Shows only while a photo is still loading.
const CHARCOAL = '#241F21';
// Room kept under each page's title for the dots and button, which float
// over the pages rather than scrolling with them.
const FOOTER_RESERVE = scaleSpace(104);

export function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const { markOnboardingSeen } = useOnboardingGate();
  // Same-render fallback only — on web the ResponsiveFrame shrinks the app
  // into a centred "phone" smaller than the raw browser window, so the paging
  // ScrollView has to size itself off the measured root (below), not off
  // useWindowDimensions.
  const window = useWindowDimensions();
  const [layoutSize, setLayoutSize] = useState<{ width: number; height: number } | null>(null);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const width = layoutSize?.width ?? window.width;
  const height = layoutSize?.height ?? window.height;
  const compact = height < 720;
  const styles = useMemo(() => makeStyles(colors, compact, rtl), [colors, compact, rtl]);

  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = index === PAGES.length - 1;

  const finish = useCallback(() => {
    markOnboardingSeen();
    router.replace('/welcome');
  }, [markOnboardingSeen, router]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    const nextIndex = index + 1;
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    setIndex(nextIndex);
  }, [finish, index, isLast, width]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(next);
    },
    [index, width]
  );

  return (
    <View style={styles.root} onLayout={handleLayout}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={onScrollEnd}
        scrollEventThrottle={16}
        style={{ width, height }}
      >
        {PAGES.map((page, i) => (
          <View key={page.titleKey} style={[styles.page, { width, height }]}>
            {/* Explicit pixel size so resizeMode="cover" crops predictably,
                sized off the measured frame rather than the window. */}
            <Image source={page.image} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" />
            <LinearGradient
              colors={SCRIM_RAMP}
              locations={SCRIM_STOPS}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <SafeAreaView style={styles.pageSafe} edges={['bottom']}>
              <Animated.View
                entering={i === index ? FadeInDown.delay(200).duration(500) : undefined}
                style={[styles.caption, rtl && styles.captionRtl]}
              >
                {/* Gold flourish, the same invitation-card rule the welcome
                    screen sets above the app's name. */}
                <View style={[styles.flourish, rtl && styles.rowRtl]}>
                  <View style={styles.flourishLine} />
                  <View style={styles.flourishDiamond} />
                </View>
                <Text style={[styles.title, rtl && styles.rtlText]} numberOfLines={2}>
                  {t(page.titleKey)}
                </Text>
              </Animated.View>
            </SafeAreaView>
          </View>
        ))}
      </ScrollView>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <Pressable onPress={finish} hitSlop={10} style={styles.skipButton} accessibilityRole="button">
          <Text style={styles.skipLabel}>{t('onboarding.skip')}</Text>
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.footerOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={[styles.footer, rtl && styles.rowRtl]}>
          {/* The page you are on is a long white pill; the rest are dim dots. */}
          <View style={[styles.dots, rtl && styles.rowRtl]}>
            {PAGES.map((p, i) => (
              <View key={p.titleKey} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <Pressable
            onPress={goNext}
            style={({ pressed }) => [
              isLast ? styles.startButton : styles.nextButton,
              glow(colors.teal, 0.5, 14, 6),
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t('onboarding.getStarted') : t('common.next')}
          >
            {isLast ? <Text style={styles.startLabel}>{t('onboarding.getStarted')}</Text> : null}
            <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: Palette, compact: boolean, rtl: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: CHARCOAL },
    page: { flex: 1, overflow: 'hidden', backgroundColor: CHARCOAL },
    pageSafe: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingBottom: FOOTER_RESERVE,
    },

    caption: { alignItems: 'flex-start' },
    captionRtl: { alignItems: 'flex-end' },
    flourish: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    flourishLine: { width: scaleSpace(32), height: 1.5, backgroundColor: colors.gold },
    flourishDiamond: { width: 6, height: 6, backgroundColor: colors.gold, transform: [{ rotate: '45deg' }] },
    title: {
      ...typography.h1,
      fontSize: scaleFont(compact ? 30 : 36),
      lineHeight: scaleFont(compact ? 36 : 44),
      color: '#FFFFFF',
      maxWidth: scaleSpace(340),
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },

    topOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: rtl ? 'flex-start' : 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    skipButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: scaleSpace(7),
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    skipLabel: { ...typography.label, color: '#FFFFFF' },

    footerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: compact ? spacing.md : spacing.lg,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    dots: { flexDirection: 'row', alignItems: 'center', gap: scaleSpace(6) },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
    dotActive: { width: 28, backgroundColor: '#FFFFFF' },

    nextButton: {
      width: scaleSpace(60),
      height: scaleSpace(60),
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.teal,
    },
    startButton: {
      height: scaleSpace(60),
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.teal,
    },
    startLabel: { ...typography.label, fontSize: scaleFont(16), color: '#FFFFFF' },
    pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  });
