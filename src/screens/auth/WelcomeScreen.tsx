import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Button } from '../../components/Button';
import { FloatingHearts } from '../../components/common/FloatingHearts';
import { SwingingLogo } from '../../components/common/SwingingLogo';
import { spacing, typography, radius } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import { scaleSpace } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

// The brand's own ramp — deep teal into gold, the two colours the logo is
// built from. It is the app's front door, so it does not follow a deck mode.
const BRAND_RAMP = ['#123234', '#1D4E52', '#3C7A5C'] as const;

const LANGUAGES = [
  { key: 'en', labelKey: 'language.english' },
  { key: 'ur', labelKey: 'language.urdu' },
  { key: 'roman', labelKey: 'language.roman' },
] as const;

export function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { language, setLanguage, t, rtl } = useLanguage();
  const { height } = useWindowDimensions();
  // Graduated layout so the welcome page always fits, from tiny foldables /
  // landscape through to big tablets. Compact trims spacing + logo on short
  // phones (e.g. iPhone SE); tiny trims further on very short viewports.
  const tiny = height < 620;
  const compact = height < 720;
  const logoSize = tiny ? 52 : compact ? 64 : 88;
  const styles = useMemo(() => makeStyles(colors, compact, tiny), [colors, compact, tiny]);

  return (
    <LinearGradient colors={BRAND_RAMP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <View style={styles.glowA} pointerEvents="none" />
      <View style={styles.glowB} pointerEvents="none" />
      <FloatingHearts colors={[colors.gold, '#FFFFFF', colors.rishta]} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <SwingingLogo size={logoSize} color={colors.teal} ringColor="#FFFFFF" />
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

        <Animated.View entering={FadeInUp.delay(420).duration(500)} style={styles.card}>
          {/* Language is a segmented control so the three options read as one
              group — a preference, not the screen's main action. */}
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
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors: Palette, compact: boolean, tiny: boolean) =>
  StyleSheet.create({
    gradient: { flex: 1, overflow: 'hidden' },
    // Two soft highlights so the backdrop has depth behind the floating hearts.
    glowA: {
      position: 'absolute',
      top: -80,
      left: -60,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(201,138,61,0.18)',
    },
    glowB: {
      position: 'absolute',
      bottom: 120,
      right: -80,
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: 'rgba(122,59,109,0.2)',
    },
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
      justifyContent: 'center',
    },
    brandTitle: {
      ...typography.h1,
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: tiny ? scaleSpace(6) : compact ? scaleSpace(12) : spacing.lg,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    tagline: {
      ...typography.body,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginTop: tiny ? scaleSpace(4) : spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: tiny ? scaleSpace(12) : compact ? scaleSpace(16) : spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    langGroup: {
      flexDirection: 'row',
      padding: scaleSpace(4),
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.borderSoft,
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
      color: colors.textSecondary,
      fontWeight: '700',
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    langLabelSelected: { color: '#FFFFFF', fontWeight: '800' },
    actions: { gap: spacing.sm },
    rtlText: { writingDirection: 'rtl' },
  });
