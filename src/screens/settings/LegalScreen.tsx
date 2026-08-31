import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function LegalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const legalRamp = [colors.teal, colors.plum] as const;

  return (
    <ScreenContainer>
      <FadeIn style={styles.placeholderBanner}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
        <Text style={[styles.placeholderText, rtl && styles.rtlText]}>{t('legal.placeholderNotice')}</Text>
      </FadeIn>

      <FadeIn delay={60}>
        <AccentHeading title={t('legal.privacyPolicyTitle')} gradient={legalRamp} style={styles.sectionHeading} />
        <View style={styles.card}>
          <Text style={[styles.body, rtl && styles.rtlText]}>{t('legal.privacyPolicyBody')}</Text>
        </View>
      </FadeIn>

      <FadeIn delay={120}>
        <AccentHeading title={t('legal.termsTitle')} gradient={legalRamp} style={styles.sectionHeading} />
        <View style={styles.card}>
          <Text style={[styles.body, rtl && styles.rtlText]}>{t('legal.termsBody')}</Text>
        </View>
      </FadeIn>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    placeholderBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: withAlpha(colors.danger, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.35),
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    placeholderText: { ...typography.caption, color: colors.danger, flex: 1, fontWeight: '600' },
    sectionHeading: { marginBottom: spacing.sm, marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.md,
    },
    body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
