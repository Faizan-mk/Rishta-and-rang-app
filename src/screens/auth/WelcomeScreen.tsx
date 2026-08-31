import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <LinearGradient colors={BRAND_RAMP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <View style={styles.glowA} pointerEvents="none" />
      <View style={styles.glowB} pointerEvents="none" />
      <FloatingHearts colors={[colors.gold, '#FFFFFF', colors.rishta]} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <SwingingLogo color={colors.teal} ringColor="#FFFFFF" />
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
          {/* Language is a segmented pill rather than three full buttons — it is
              a preference, not the screen's main action. */}
          <View style={styles.langRow}>
            {LANGUAGES.map((option) => {
              const selected = language === option.key;
              return (
                <Pressable key={option.key} onPress={() => setLanguage(option.key)} style={styles.langSlot}>
                  {selected ? (
                    <LinearGradient
                      colors={[colors.teal, colors.sage]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.langOption, glow(colors.teal, 0.5, 12, 5)]}
                    >
                      <Text style={[styles.langLabel, styles.langLabelSelected]}>{t(option.labelKey)}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.langOption, styles.langOptionIdle]}>
                      <Text style={styles.langLabel}>{t(option.labelKey)}</Text>
                    </View>
                  )}
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

const makeStyles = (colors: Palette) =>
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
    safeArea: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
    brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    brandTitle: {
      ...typography.h1,
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: spacing.lg,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    tagline: {
      ...typography.body,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    langRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
    langSlot: { flex: 1 },
    langOption: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingVertical: spacing.sm + 2,
    },
    langOptionIdle: {
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
    },
    langLabel: { ...typography.label, color: colors.textSecondary, fontWeight: '700' },
    langLabelSelected: { color: '#FFFFFF', fontWeight: '800' },
    actions: { gap: spacing.sm },
    rtlText: { writingDirection: 'rtl' },
  });
