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
import { fonts, spacing, typography, radius } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import { scaleFont, scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { useOnboardingGate } from '../../store/OnboardingGateContext';

// The signature Rosewood-to-Coral ramp. It is the app's front door, so it does
// not follow a deck mode.
const BRAND_RAMP = ['#5E0F2E', '#8E1B45', '#F2715E'] as const;
// Champagne gold, fixed rather than themed: this screen always sits on a dark
// photo, so it wants the bright gold in both themes.
const GOLD = '#E9C27A';
// Darkens the top of the photo for the title and the bottom for the sheet,
// leaving the couple untouched. Measured on this asset, the couple's heads
// sit in the 10-20% band: a 10x20 luminance grid puts the brightest cells in
// the whole upper image (183 and 199) at the centre column across 10-20%,
// while the rows either side of it fall away. `cover` shows the image's full
// height — it only crops the sides — so those rows land on the same rows of
// the screen. The top scrim therefore hands over at 0.2, which is above the
// faces: the title in the first ~16% stays legible and the couple keeps its
// light.
const SCRIM_RAMP = ['rgba(20,11,16,0.78)', 'rgba(20,11,16,0)', 'rgba(20,11,16,0)', 'rgba(20,11,16,0.85)'] as const;
const SCRIM_STOPS = [0, 0.2, 0.5, 1] as const;
const HERO_IMAGE = require('../../../assets/images/welcome-wedding.png');
// Aubergine black: shows only if the photo is still loading.
const PLUM_DEEP = '#140B10';

const LANGUAGES = [
  { key: 'en', labelKey: 'language.english' },
  { key: 'ur', labelKey: 'language.urdu' },
  { key: 'roman', labelKey: 'language.roman' },
] as const;

export function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
      <LinearGradient colors={SCRIM_RAMP} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <FloatingHearts colors={[colors.gold, '#FFFFFF', colors.rishta]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          {/* Thin gold flourish, the invitation-card rule above the name. */}
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.flourish}>
            <View style={styles.flourishLine} />
            <View style={styles.flourishDiamond} />
            <View style={styles.flourishLine} />
          </Animated.View>
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
            intensity={40}
            tint="dark"
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
                        colors={['#8E1B45', '#F2715E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.langOption, glow('#8E1B45', 0.4, 10, 4)]}
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
                style={styles.outlineButton}
                labelStyle={styles.outlineLabel}
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
      // Held tight to the status bar, and the title's leading and gaps are
      // trimmed, so the block's bottom edge finishes around 16% of the height
      // instead of 22%. That narrows the overlap with the couple's heads but
      // does not remove it — clearing it entirely needs the photo anchored to
      // the bottom of the screen instead of full-bleed. Side/bottom padding
      // stays as spacing.lg.
      paddingTop: scaleSpace(8),
      paddingBottom: compact ? spacing.lg : spacing.xl,
    },
    brand: {
      flexGrow: 1,
      flexShrink: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    flourish: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: tiny ? scaleSpace(2) : compact ? scaleSpace(4) : scaleSpace(8),
    },
    flourishLine: { width: scaleSpace(36), height: 1, backgroundColor: GOLD },
    flourishDiamond: {
      width: scaleSpace(7),
      height: scaleSpace(7),
      backgroundColor: GOLD,
      transform: [{ rotate: '45deg' }],
    },
    brandTitle: {
      ...typography.h1,
      fontSize: scaleFont(tiny ? 30 : 36),
      // Tightened from 44: the extra leading was only pushing the tagline
      // down over the couple, so the block's bottom edge sits higher.
      lineHeight: scaleFont(tiny ? 34 : 40),
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: scaleSpace(2),
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    tagline: {
      ...typography.body,
      fontFamily: fonts.displayItalic,
      fontSize: scaleFont(17),
      color: GOLD,
      textAlign: 'center',
      marginTop: scaleSpace(2),
      paddingHorizontal: spacing.lg,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    // Glass card: rounded + clipped so the blur and tint respect the corner
    // radius, with a hairline border to catch the light like real glass.
    card: {
      borderRadius: scaleSpace(32),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: withAlpha(GOLD, 0.35),
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    cardTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(20,11,16,0.35)',
    },
    cardContent: {
      padding: tiny ? scaleSpace(12) : compact ? scaleSpace(16) : spacing.lg,
    },
    langGroup: {
      flexDirection: 'row',
      padding: scaleSpace(4),
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
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
      color: 'rgba(255,255,255,0.75)',
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    langLabelSelected: {
      color: '#FFFFFF',
      fontFamily: fonts.bodyBold,
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    actions: { gap: spacing.sm },
    // Secondary action per the design system: an outlined champagne-gold pill.
    outlineButton: { borderWidth: 1.5, borderColor: GOLD, backgroundColor: 'rgba(255,255,255,0.1)' },
    outlineLabel: { color: '#FFFFFF', fontFamily: fonts.bodyBold },
    devReset: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      paddingVertical: scaleSpace(4),
      paddingHorizontal: spacing.sm,
    },
    devResetText: {
      ...typography.label,
      color: 'rgba(255,255,255,0.55)',
      textDecorationLine: 'underline',
    },
    rtlText: { writingDirection: 'rtl' },
  });
