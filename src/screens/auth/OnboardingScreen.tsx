import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { FloatingHearts } from '../../components/common/FloatingHearts';
import { spacing, typography } from '../../theme';
import { glow } from '../../theme/glow';
import { scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { useOnboardingGate } from '../../store/OnboardingGateContext';

const COUPLE_IMAGE = require('../../../assets/images/welcome-couple.png');
const FRIENDS_IMAGE = require('../../../assets/images/onboarding-friends.png');
const BRAND_RAMP = ['#123234', '#1D4E52', '#3C7A5C'] as const;
const CARD_RADIUS = 28;
// Full-bleed page's own scrim: strong enough at top for the title, easing
// off over the illustration, deepening again toward the footer.
const PHOTO_SCRIM = ['rgba(20,8,10,0.55)', 'rgba(20,8,10,0.05)', 'rgba(20,8,10,0.55)'] as const;

type IconName = keyof typeof Ionicons.glyphMap;

interface OnboardingPage {
  layout: 'card' | 'photo';
  badgeIcon: IconName;
  ramp: readonly [string, string, ...string[]];
  titleKey: string;
  subtitleKey: string;
  chips: { icon: IconName; labelKey: string }[];
}

function buildPages(colors: Palette): OnboardingPage[] {
  return [
    {
      layout: 'card',
      badgeIcon: 'heart',
      ramp: [colors.teal, colors.plum] as const,
      titleKey: 'onboarding.page1.title',
      subtitleKey: 'onboarding.page1.subtitle',
      chips: [],
    },
    {
      layout: 'photo',
      badgeIcon: 'chatbubble-ellipses',
      ramp: [colors.dating, colors.plum] as const,
      titleKey: 'onboarding.page2.title',
      subtitleKey: 'onboarding.page2.subtitle',
      chips: [
        { icon: 'shield-checkmark', labelKey: 'onboarding.page2.chipSafe' },
        { icon: 'people', labelKey: 'onboarding.page2.chipReal' },
      ],
    },
  ];
}

export function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const { markOnboardingSeen } = useOnboardingGate();
  // Same-render fallback only — on web the ResponsiveFrame shrinks the app
  // into a centred "phone" smaller than the raw browser window, so the
  // paging ScrollView has to size itself off the measured root (below),
  // not off useWindowDimensions.
  const window = useWindowDimensions();
  const [layoutSize, setLayoutSize] = useState<{ width: number; height: number } | null>(null);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const width = layoutSize?.width ?? window.width;
  const height = layoutSize?.height ?? window.height;
  const compact = height < 720;
  const pages = useMemo(() => buildPages(colors), [colors]);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const styles = useMemo(() => makeStyles(colors, compact, rtl), [colors, compact, rtl]);

  const finish = useCallback(() => {
    markOnboardingSeen();
    router.replace('/welcome');
  }, [markOnboardingSeen, router]);

  const isLast = index === pages.length - 1;

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
        {pages.map((page, i) =>
          page.layout === 'card' ? (
            <CardPage
              key={page.titleKey}
              page={page}
              active={i === index}
              index={i}
              total={pages.length}
              width={width}
              height={height}
              colors={colors}
              styles={styles}
              t={t}
            />
          ) : (
            <PhotoPage
              key={page.titleKey}
              page={page}
              active={i === index}
              index={i}
              total={pages.length}
              width={width}
              height={height}
              colors={colors}
              styles={styles}
              t={t}
            />
          )
        )}
      </ScrollView>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <Pressable onPress={finish} hitSlop={10} style={styles.skipButton}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.footer}>
          <View style={styles.dots}>
            {pages.map((page, i) => (
              <View key={page.titleKey} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <Button
            label={isLast ? t('onboarding.getStarted') : t('common.next')}
            gradient={BRAND_RAMP}
            onPress={goNext}
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

interface PageProps {
  page: OnboardingPage;
  active: boolean;
  index: number;
  total: number;
  width: number;
  height: number;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: (key: string) => string;
}

// Page 1: a bounded, rounded photo card sitting inside a coloured page — the
// couple's portrait framed like a keepsake.
function CardPage({ page, active, index, total, width, height, colors, styles, t }: PageProps) {
  return (
    <LinearGradient colors={page.ramp} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.page, { width, height }]}>
      <View style={styles.glowA} pointerEvents="none" />
      <View style={styles.glowB} pointerEvents="none" />
      {active && <FloatingHearts colors={['#FFFFFF', 'rgba(255,255,255,0.55)', colors.gold]} />}
      <SafeAreaView style={styles.pageSafe} edges={['top', 'bottom']}>
        <PageEyebrow icon={page.badgeIcon} index={index} total={total} active={active} styles={styles} />
        <Animated.Text entering={active ? FadeInDown.delay(120).duration(500) : undefined} style={styles.title}>
          {t(page.titleKey)}
        </Animated.Text>

        {/* The couple art's own baked-in gradient gives the top of the photo
            a plain zone, so the title above visually bleeds into the image
            instead of stopping short. */}
        <Animated.View entering={active ? FadeInDown.delay(220).duration(550) : undefined} style={styles.card}>
          <View style={styles.cardClip}>
            <Image source={COUPLE_IMAGE} style={styles.cardImage} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(11,7,13,0.35)', 'rgba(11,7,13,0)', 'rgba(11,7,13,0.5)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>
          <View style={[styles.badge, styles.badgeLeft]}>
            <LinearGradient colors={BRAND_RAMP} style={StyleSheet.absoluteFill} />
            <Ionicons name={page.badgeIcon} size={22} color="#FFFFFF" />
          </View>
          <View style={[styles.badge, styles.badgeRight]}>
            <LinearGradient colors={[colors.gold, '#F3D19B']} style={StyleSheet.absoluteFill} />
            <Ionicons name="shield-checkmark" size={20} color="#123234" />
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Page 2: the opposite treatment on purpose — an immersive full-bleed photo
// with the copy floating straight on top of it, no card, so the two pages of
// the intro don't read as the same template re-skinned.
function PhotoPage({ page, active, index, total, width, height, colors, styles, t }: PageProps) {
  return (
    <View style={[styles.page, { width, height }]}>
      <Image source={FRIENDS_IMAGE} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" />
      <LinearGradient colors={PHOTO_SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {active && <FloatingHearts colors={['#FFFFFF', 'rgba(255,255,255,0.55)', colors.gold]} />}
      <SafeAreaView style={styles.photoSafe} edges={['top', 'bottom']}>
        <View>
          <PageEyebrow icon={page.badgeIcon} index={index} total={total} active={active} styles={styles} />
          <Animated.Text entering={active ? FadeInDown.delay(120).duration(500) : undefined} style={styles.title}>
            {t(page.titleKey)}
          </Animated.Text>
          <Animated.Text entering={active ? FadeInDown.delay(220).duration(500) : undefined} style={styles.subtitle}>
            {t(page.subtitleKey)}
          </Animated.Text>
        </View>

        <Animated.View entering={active ? FadeInUp.delay(280).duration(500) : undefined} style={styles.chipRow}>
          {page.chips.map((chip) => (
            <View key={chip.labelKey} style={styles.chip}>
              <Ionicons name={chip.icon} size={15} color="#FFFFFF" />
              <Text style={styles.chipText}>{t(chip.labelKey)}</Text>
            </View>
          ))}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function PageEyebrow({
  icon,
  index,
  total,
  active,
  styles,
}: {
  icon: IconName;
  index: number;
  total: number;
  active: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Animated.View entering={active ? FadeInDown.delay(60).duration(450) : undefined} style={styles.eyebrow}>
      <Ionicons name={icon} size={13} color="#FFFFFF" />
      <Text style={styles.eyebrowText}>
        {index + 1} / {total}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (colors: Palette, compact: boolean, rtl: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.plum },
    page: { flex: 1, overflow: 'hidden' },
    // Two soft highlights so the backdrop has depth behind the card, echoing
    // the same treatment on the welcome screen.
    glowA: {
      position: 'absolute',
      top: -70,
      right: -70,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    glowB: {
      position: 'absolute',
      bottom: 40,
      left: -90,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    pageSafe: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: compact ? scaleSpace(48) : scaleSpace(60),
    },
    // Page 2's own safe area: eyebrow/title/subtitle pinned near the top
    // (where the photo's baked gradient is plain), chips pinned near the
    // bottom, with the photo itself filling everything between.
    photoSafe: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: compact ? scaleSpace(48) : scaleSpace(60),
      paddingBottom: compact ? scaleSpace(96) : scaleSpace(116),
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaleSpace(6),
      alignSelf: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: scaleSpace(5),
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      marginBottom: spacing.sm,
    },
    eyebrowText: {
      ...typography.label,
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    title: {
      ...typography.h1,
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '800',
      marginBottom: compact ? spacing.sm : spacing.md,
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    // The photo card: rounded, clipped, with room below it for the two
    // badges to hang half off the bottom edge. `card` itself stays
    // overflow: visible so the badges and shadow aren't cut off; the photo
    // and its scrim are clipped by the nested cardClip instead.
    card: {
      width: '100%',
      flex: 1,
      maxHeight: compact ? 340 : 420,
      marginBottom: compact ? spacing.xl : spacing.xl + spacing.sm,
    },
    cardClip: {
      flex: 1,
      borderRadius: CARD_RADIUS,
      overflow: 'hidden',
      ...glow('#000000', 0.3, 20, 10),
    },
    cardImage: {
      width: '100%',
      height: '100%',
    },
    badge: {
      position: 'absolute',
      bottom: -18,
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: '#FFFFFF',
      ...glow('#000000', 0.25, 12, 6),
    },
    badgeLeft: { left: 24 },
    badgeRight: { right: 24 },
    subtitle: {
      ...typography.body,
      color: 'rgba(255,255,255,0.92)',
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: spacing.sm,
    },
    // Page 2's feature chips, standing in for page 1's floating badges — a
    // horizontal row instead of circles overlapping a card, so the two
    // pages don't share a silhouette even though both use small icon marks.
    chipRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaleSpace(6),
      paddingHorizontal: spacing.md,
      paddingVertical: scaleSpace(9),
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    chipText: {
      ...typography.label,
      color: '#FFFFFF',
      fontWeight: '700',
    },
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
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    bottomOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: compact ? spacing.lg : spacing.xl,
      gap: spacing.md,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: scaleSpace(8),
    },
    dot: {
      width: scaleSpace(8),
      height: scaleSpace(8),
      borderRadius: scaleSpace(4),
      backgroundColor: 'rgba(255,255,255,0.4)',
    },
    dotActive: {
      width: scaleSpace(22),
      backgroundColor: '#FFFFFF',
    },
  });
