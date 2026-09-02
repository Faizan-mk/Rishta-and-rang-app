import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { LEGAL_URLS, SUPPORT_EMAIL } from '../../constants/Config';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

// Section ids, in reading order. The copy lives in the dictionaries under
// `legal.privacy.<id>` / `legal.terms.<id>`, so all three languages carry the
// same document rather than an English original and two summaries.
const PRIVACY_SECTIONS = [
  'whoWeAre',
  'dataWeCollect',
  'howWeUse',
  'legalBasis',
  'sharing',
  'retention',
  'yourRights',
  'security',
  'ageLimit',
  'changes',
  'contact',
] as const;

const TERMS_SECTIONS = [
  'eligibility',
  'yourAccount',
  'acceptableUse',
  'prohibited',
  'contentLicence',
  'safety',
  'subscriptions',
  'termination',
  'disclaimers',
  'liability',
  'disputes',
  'changes',
] as const;

export function LegalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { notify } = useDialog();
  const legalRamp = [colors.teal, colors.plum] as const;

  const openUrl = async (url: string) => {
    // The hosted copies are configured per build; without one, say so rather
    // than opening a dead link — the in-app text below is the same document.
    if (!url || !(await Linking.canOpenURL(url).catch(() => false))) {
      await notify({ title: t('legal.title'), message: t('common.linkUnavailable') });
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <ScreenContainer>
      <FadeIn>
        <Text style={[styles.updated, rtl && styles.rtlText]}>{t('legal.lastUpdated')}</Text>
      </FadeIn>

      <FadeIn delay={60}>
        <AccentHeading title={t('legal.privacyPolicyTitle')} gradient={legalRamp} style={styles.sectionHeading} />
        <View style={styles.card}>
          <Text style={[styles.intro, rtl && styles.rtlText]}>{t('legal.privacyIntro')}</Text>
          {PRIVACY_SECTIONS.map((id) => (
            <Clause key={id} id={`legal.privacy.${id}`} styles={styles} rtl={rtl} t={t} />
          ))}
        </View>
        <OpenOnlineRow
          label={t('legal.readPrivacyOnline')}
          onPress={() => openUrl(LEGAL_URLS.privacy)}
          styles={styles}
          colors={colors}
          rtl={rtl}
        />
      </FadeIn>

      <FadeIn delay={120}>
        <AccentHeading title={t('legal.termsTitle')} gradient={legalRamp} style={styles.sectionHeading} />
        <View style={styles.card}>
          <Text style={[styles.intro, rtl && styles.rtlText]}>{t('legal.termsIntro')}</Text>
          {TERMS_SECTIONS.map((id) => (
            <Clause key={id} id={`legal.terms.${id}`} styles={styles} rtl={rtl} t={t} />
          ))}
        </View>
        <OpenOnlineRow
          label={t('legal.readTermsOnline')}
          onPress={() => openUrl(LEGAL_URLS.terms)}
          styles={styles}
          colors={colors}
          rtl={rtl}
        />
      </FadeIn>

      <FadeIn delay={180}>
        <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <Text style={[styles.contact, rtl && styles.rtlText]}>
            {t('legal.contactLine', { email: SUPPORT_EMAIL })}
          </Text>
        </Pressable>
      </FadeIn>
    </ScreenContainer>
  );
}

function Clause({
  id,
  styles,
  rtl,
  t,
}: {
  id: string;
  styles: ReturnType<typeof makeStyles>;
  rtl: boolean;
  t: (path: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <View style={styles.clause}>
      <Text style={[styles.clauseTitle, rtl && styles.rtlText]}>{t(`${id}.title`)}</Text>
      <Text style={[styles.body, rtl && styles.rtlText]}>{t(`${id}.body`, { email: SUPPORT_EMAIL })}</Text>
    </View>
  );
}

function OpenOnlineRow({
  label,
  onPress,
  styles,
  colors,
  rtl,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  rtl: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.linkRow, rtl && styles.linkRowRtl]}>
      <Ionicons name="open-outline" size={16} color={colors.teal} />
      <Text style={[styles.linkLabel, rtl && styles.rtlText]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    updated: { ...typography.caption, color: colors.textTertiary, fontWeight: '600' },
    sectionHeading: { marginBottom: spacing.sm, marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.md,
      gap: spacing.md,
    },
    intro: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
    clause: { gap: spacing.xs },
    clauseTitle: { ...typography.bodyBold, color: colors.textPrimary, fontWeight: '800' },
    body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: withAlpha(colors.teal, 0.3),
      backgroundColor: withAlpha(colors.teal, 0.08),
    },
    linkRowRtl: { flexDirection: 'row-reverse' },
    linkLabel: { ...typography.label, color: colors.teal, fontWeight: '800' },
    contact: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
