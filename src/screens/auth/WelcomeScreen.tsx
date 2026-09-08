import React, { useCallback, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Button } from '../../components/Button';
import { FloatingHearts } from '../../components/common/FloatingHearts';
import { spacing, typography, radius } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import { scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { useOnboardingGate } from '../../store/OnboardingGateContext';

// The brand's own ramp — deep teal into gold, the two colours the logo is
// built from. It is the app's front door, so it does not follow a deck mode.
const BRAND_RAMP = ['#123234', '#1D4E52', '#3C7A5C'] as const;
// A soft top-to-bottom scrim over the hero art, just enough to keep the
// title readable without flattening the illustration underneath it.
const SCRIM_RAMP = ['rgba(11,7,13,0.55)', 'rgba(11,7,13,0.05)', 'rgba(11,7,13,0.05)'] as const;
const HERO_IMAGE = require('../../../assets/images/welcome-couple.png');
// Matches the illustration's own baked-in gradient floor, so any letterboxed
// edge blends straight into the photo instead of showing a seam.
const PLUM_DEEP = '#1C0D21';

const LANGUAGES = [
  { key: 'en', labelKey: 'language.english' },
  { key: 'ur', labelKey: 'language.urdu' },
  { key: 'roman', labelKey: 'language.roman' },
] as const;

export function WelcomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { language, setLanguage, t, rtl } = useLanguage();
  const { resetOnboardingSeen } = useOnboardingGate();
  // On native this equals the screen; on web it's the raw browser window,
  // which the ResponsiveFrame then shrinks to a centred "phone" — so it's
  // only a same-render fallback until onLayout reports the frame's actual
  // rendered size below.
  const window = useWindowDimensions();
  const [layoutSize, setLayoutSize] = useState<{ width: number; height: number } | null>(null);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const width = layoutSize?.width ?? window.width;
  const height = layoutSize?.height ?? window.height;
  // Graduated layout so the welcome page always fits, from tiny foldables /
  // landscape through to big tablets. Compact trims spacing on short phones
  // (e.g. iPhone SE); tiny trims further on very short viewports.
  const tiny = height < 620;
  const compact = height < 720;
  const styles = useMemo(() => makeStyles(colors, compact, tiny), [colors, compact, tiny]);

  return (
    <View style={styles.root} onLayout={handleLayout}>
      {/* Full-bleed photo behind everything — explicit pixel size (not a
          flex share) so resizeMode="cover" always crops predictably, and
          sized off the measured container (see `handleLayout`) rather than
          the window, so it stays correct inside the web "phone frame". */}
      <Image source={HERO_IMAGE} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" />
      <LinearGradient colors={SCRIM_RAMP} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <FloatingHearts colors={[colors.gold, '#FFFFFF', colors.rishta]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={styles.brandTitle}>
            {t('appName')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(320).duration(500)}
            style={[styles.tagline, rtl && styles.rtlText]}
          >
            {t('language.subtitle')}
          </Animated.Text>
        </View>

        {/* Frosted glass sheet: a real blur of the photo behind it plus a
            faint white wash, so the couple stays visible through the card
            instead of being covered by a solid panel. */}
        <Animated.View entering={FadeInUp.delay(420).duration(500)} style={styles.card}>
          <BlurView
            intensity={55}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.cardTint} pointerEvents="none" />
          <View style={styles.cardContent}>
            {/* Language is a segmented control so the three options read as
                one group — a preference, not the screen's main action. */}
            <View style={styles.langGroup}>
              {LANGUAGES.map((option) => {
                const selected = language === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setLanguage(option.key)}
                    style={[styles.langSlot, selected && styles.langSlotSelected]}
                  >
                    {selected && (
                      <LinearGradient
                        colors={[colors.teal, colors.sage]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.langOption, glow(colors.teal, 0.4, 10, 4)]}
                        pointerEvents="none"
                      />
                    )}
                    <Text style={[styles.langLabel, selected && styles.langLabelSelected]}>
                      {t(option.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actions}>
              <Button label={t('login.submit')} gradient={BRAND_RAMP} onPress={() => router.push('/login')} />
              <Button
                label={t('login.createAccount')}
                variant="ghost"
                onPress={() => router.push('/signup')}
              />
            </View>

            {/* Dev-only escape hatch: replays the two-page intro without
                needing to clear app storage or reinstall — see the "welcome
                shows first" thread this was added for. Stripped from
                release builds by the __DEV__ check. */}
            {__DEV__ && (
              <Pressable
                onPress={() => {
                  resetOnboardingSeen();
                  router.replace('/onboarding');
                }}
                style={styles.devReset}
                hitSlop={8}
              >
                <Text style={styles.devResetText}>Replay intro (dev)</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: Palette, compact: boolean, tiny: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: PLUM_DEEP, overflow: 'hidden' },
    safeArea: {
      flex: 1,
      justifyContent: 'space-between',
      padding: spacing.lg,
      paddingBottom: compact ? spacing.lg : spacing.xl,
    },
    brand: {
      flexGrow: 1,
      flexShrink: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    brandTitle: {
      ...typography.h1,
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: tiny ? scaleSpace(6) : compact ? scaleSpace(12) : spacing.lg,
      fontWeight: '800',
      letterSpacing: 0.5,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    tagline: {
      ...typography.body,
      color: 'rgba(255,255,255,0.9)',
      textAlign: 'center',
      marginTop: tiny ? scaleSpace(4) : spacing.sm,
      paddingHorizontal: spacing.lg,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    // Glass card: rounded + clipped so the blur and tint respect the corner
    // radius, with a hairline border to catch the light like real glass.
    card: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    cardTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.34),
    },
    cardContent: {
      padding: tiny ? scaleSpace(12) : compact ? scaleSpace(16) : spacing.lg,
    },
    langGroup: {
      flexDirection: 'row',
      padding: scaleSpace(4),
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      marginBottom: tiny ? spacing.sm : compact ? spacing.md : spacing.lg,
    },
    langSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      overflow: 'hidden',
      paddingVertical: tiny ? scaleSpace(7) : compact ? scaleSpace(9) : scaleSpace(11),
      paddingHorizontal: spacing.xs,
    },
    langSlotSelected: {
      backgroundColor: 'transparent',
    },
    langOption: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    langLabel: {
      ...typography.label,
      color: 'rgba(28,13,33,0.75)',
      fontWeight: '700',
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    langLabelSelected: {
      color: '#FFFFFF',
      fontWeight: '800',
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    actions: { gap: spacing.sm },
    devReset: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      paddingVertical: scaleSpace(4),
      paddingHorizontal: spacing.sm,
    },
    devResetText: {
      ...typography.label,
      color: 'rgba(28,13,33,0.5)',
      textDecorationLine: 'underline',
    },
    rtlText: { writingDirection: 'rtl' },
  });
