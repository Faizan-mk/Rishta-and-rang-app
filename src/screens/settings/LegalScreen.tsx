import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

export function LegalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();

  return (
    <ScreenContainer>
      <FadeIn style={styles.placeholderBanner}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
        <Text style={[styles.placeholderText, rtl && styles.rtlText]}>{t('legal.placeholderNotice')}</Text>
      </FadeIn>

      <FadeIn delay={60}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('legal.privacyPolicyTitle')}</Text>
        <View style={styles.card}>
          <Text style={[styles.body, rtl && styles.rtlText]}>{t('legal.privacyPolicyBody')}</Text>
        </View>
      </FadeIn>

      <FadeIn delay={120}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('legal.termsTitle')}</Text>
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
      backgroundColor: colors.dangerSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    placeholderText: { ...typography.caption, color: colors.danger, flex: 1 },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
