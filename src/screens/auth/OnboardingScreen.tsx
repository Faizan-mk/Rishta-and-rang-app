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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { AccentHeading } from '../../components/common/AccentHeading';
import { Chip } from '../../components/common/Chip';
import { ProgressDots } from '../../components/common/ProgressDots';
import { radius, spacing, typography } from '../../theme';
import { modeAccent, withAlpha } from '../../theme/glow';
import { scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import type { ProfileMode } from '../../types/user';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { useOnboardingGate } from '../../store/OnboardingGateContext';

const COUPLE_IMAGE = require('../../../assets/images/welcome-wedding.png');
const FRIENDS_IMAGE = require('../../../assets/images/onboarding-friends.png');

type IconName = keyof typeof Ionicons.glyphMap;

interface OnboardingPage {
  // Each page borrows one of the app's two mode colour worlds, so the intro
  // teaches the same rose-versus-coral distinction the deck does. The accent
  // is derived per render from the palette, so it tracks light/dark instead of
  // being frozen into local hex values the way this screen used to.
  mode: ProfileMode;
  icon: IconName;
  image: ImageSourcePropType;
  titleKey: string;
  subtitleKey: string;
  chips: { icon: IconName; labelKey: string }[];
}

const PAGES: OnboardingPage[] = [
  {
    mode: 'rishta',
    icon: 'shield-checkmark',
    image: COUPLE_IMAGE,
    titleKey: 'onboarding.page1.title',
    subtitleKey: 'onboarding.page1.subtitle',
    chips: [],
  },
  {
    mode: 'dating',
    icon: 'chatbubble-ellipses',
    image: FRIENDS_IMAGE,
    titleKey: 'onboarding.page2.title',
    subtitleKey: 'onboarding.page2.subtitle',
    chips: [
      { icon: 'shield-checkmark', labelKey: 'onboarding.page2.chipSafe' },
      { icon: 'people', labelKey: 'onboarding.page2.chipReal' },
    ],
  },
];

// The footer bar is a fixed overlay, so every page reserves this much room
// below its content rather than letting the photo slide underneath the button.
const FOOTER_RESERVE = scaleSpace(152);

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

  // The primary action wears the current page's ramp, so the button changes
  // colour as the intro moves from the Rishta story to the Friends one.
  const accent = useMemo(() => modeAccent(colors, PAGES[index].mode), [colors, index]);

  const finish = useCallback(() => {
    markOnboardingSeen();
    router.replace('/welcome');
  }, [markOnboardingSeen, router]);

  const isLast = index === PAGES.length - 1;

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
        {PAGES.map((page, i) => (
          <OnboardingPageView
            key={page.titleKey}
            page={page}
            active={i === index}
            width={width}
            height={height}
            styles={styles}
            t={t}
            rtl={rtl}
          />
        ))}
      </ScrollView>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <Pressable onPress={finish} hitSlop={10} style={styles.skipButton}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.footerBar} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.footer}>
          <ProgressDots total={PAGES.length} current={index} />
          <Button
            label={isLast ? t('onboarding.getStarted') : t('common.next')}
            gradient={accent.ramp}
            onPress={goNext}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

interface PageProps {
  page: OnboardingPage;
  active: boolean;
  width: number;
  height: number;
  styles: ReturnType<typeof makeStyles>;
  t: (key: string) => string;
  rtl: boolean;
}

// One template for both pages. The earlier version deliberately gave them two
// different silhouettes — a floating photo card on a coloured page, then a
// full-bleed photo with the copy on top — on the theory that variety reads as
// designed. It reads as two unrelated screens, and the full-bleed one had to
// stack a second scrim over a photo that already carried a baked gradient, so
// both came out muddy. The pages now differ the way the rest of the app
// differs: by accent colour, not by layout.
function OnboardingPageView({ page, active, width, height, styles, t, rtl }: PageProps) {
  const { colors } = useTheme();
  const accent = useMemo(() => modeAccent(colors, page.mode), [colors, page.mode]);

  return (
    <View style={[styles.page, { width, height }]}>
      {/* A faint wash of the page's own accent, standing in for the animated
          aurora the deck uses. Static on purpose: the intro is two quick pages
          and doesn't need a 20-second colour cycle behind the copy. */}
      <LinearGradient
        colors={[withAlpha(accent.primary, 0.13), withAlpha(accent.secondary, 0.06), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.pageSafe} edges={['top', 'bottom']}>
        <Animated.View entering={active ? FadeInDown.delay(60).duration(450) : undefined} style={styles.head}>
          <AccentHeading title={t(page.titleKey)} gradient={accent.duo} size="screen" centered style={styles.headTitle} />
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t(page.subtitleKey)}</Text>
        </Animated.View>

        {/* The photo sits in a plain rounded frame, the same shape every photo
            uses across the app. Nothing is ever written on top of it, so
            resizeMode="cover" is free to crop wherever each image needs to.

            The two assets are not the same shape, and the card crops each
            differently on purpose. welcome-wedding.png is 0.75, almost exactly
            the card's ratio, so it keeps nearly the whole frame. 
            onboarding-friends.png is 0.55 and taller, so the card's cover crop
            trims it to roughly its 16-84% band: that keeps the 35-65% band
            where its subjects actually are, centred, and leaves a slice of the
            flat gradient it carries at each end as a free vignette. The page
            adds no scrim of its own over the top of the photo, which is what
            used to turn that gradient to mud. */}
        <Animated.View entering={active ? FadeIn.delay(140).duration(520) : undefined} style={styles.photo}>
          <Image source={page.image} style={styles.photoImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(20,11,16,0)', 'rgba(20,11,16,0.42)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.photoBadge}>
            <LinearGradient
              colors={accent.duo}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name={page.icon} size={17} color="#FFFFFF" />
          </View>
        </Animated.View>

        {page.chips.length > 0 ? (
          <Animated.View
            entering={active ? FadeInDown.delay(220).duration(480) : undefined}
            style={[styles.chipRow, rtl && styles.chipRowRtl]}
          >
            {page.chips.map((chip) => (
              <Chip key={chip.labelKey} icon={chip.icon} label={t(chip.labelKey)} tone={page.mode} />
            ))}
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: Palette, compact: boolean, rtl: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    page: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
    pageSafe: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: compact ? scaleSpace(8) : scaleSpace(12),
      paddingBottom: FOOTER_RESERVE,
    },

    // The title block keeps the app's own AccentHeading treatment, so the intro
    // opens with the same heading every other screen does. The subtitle is a
    // separate line rather than AccentHeading's `subtitle` slot because that
    // one is caption-sized, and this copy is two lines of running text.
    head: { width: '100%', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    // The heading has to be told to fill the row it sits in. Left to measure
    // itself inside this centred column it laid "Serious rishtas, made simple"
    // out on one line at its natural width, which on a 360pt phone ran past
    // both edges of the screen — and because the page clips its overflow, both
    // ends of the title were sheared off. Stretched, it wraps onto two lines
    // and the whole title stays on screen.
    headTitle: { alignSelf: 'stretch' },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: scaleSpace(340),
    },

    photo: {
      flex: 1,
      width: '100%',
      maxWidth: scaleSpace(360),
      // A floor, not a target: on a short phone the page gives the photo
      // whatever is left after the heading, the chips and the footer bar, and
      // this only stops it collapsing to nothing on the very smallest screens.
      // Set too high it pushed the last chip row down under the footer, which
      // is what made the second page feel like it ran off the bottom.
      minHeight: compact ? scaleSpace(120) : scaleSpace(170),
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#2A1720',
      shadowOpacity: 0.1,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    photoImage: { width: '100%', height: '100%' },
    // Hangs off the photo's bottom-leading corner, echoing the verified mark
    // used on profiles without stealing the image's centre.
    photoBadge: {
      position: 'absolute',
      bottom: spacing.md,
      left: spacing.md,
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.surface,
      shadowColor: '#000000',
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },

    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    chipRowRtl: { flexDirection: 'row-reverse' },

    // Skip reads as a quiet control on the light page rather than the dark
    // translucent circle it was when the page behind it was a photo.
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
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#2A1720',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },

    // A solid bar with a hairline, so the primary action always has a surface
    // under it no matter what the page is doing behind it.
    footerBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },

    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
