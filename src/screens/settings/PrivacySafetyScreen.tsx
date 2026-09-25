import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { SettingsRow } from '../../components/common/SettingsRow';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { usePrivacy } from '../../store/PrivacyContext';
import { useMatches } from '../../store/MatchesContext';
import { radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function PrivacySafetyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { deleteAccount } = useAuth();
  const { confirm, notify } = useDialog();
  const { prefs, setPref } = usePrivacy();
  const { blockedProfiles } = useMatches();
  const safeRamp = [colors.teal, colors.dating] as const;

  const onDeleteAccount = async () => {
    const confirmed = await confirm({
      title: t('privacy.deleteAccountConfirmTitle'),
      message: t('privacy.deleteAccountConfirmBody'),
      confirmLabel: t('privacy.deleteAccountConfirmLabel'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteAccount();
    } catch (e) {
      // Supabase won't delete an account with a session older than a few minutes.
      // Nothing was removed, so the member can log in again and retry.
      const reauth = e instanceof Error && e.message === 'REAUTH_REQUIRED';
      await notify({
        title: t('privacy.deleteAccountFailedTitle'),
        message: reauth ? t('privacy.deleteAccountReauth') : t('privacy.deleteAccountFailedBody'),
      });
    }
  };

  return (
    <ScreenContainer>
      <FadeIn>
        <AccentHeading
          title={t('privacy.visibilitySection')}
          gradient={safeRamp}
          style={styles.firstSectionHeading}
        />
        <View style={styles.card}>
          <SettingsRow
            icon="eye-outline"
            label={t('privacy.profileVisible')}
            description={t('privacy.profileVisibleDesc')}
            right="switch"
            switchValue={prefs.profileVisible}
            onSwitchChange={(value) => setPref('profileVisible', value)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="radio-outline"
            label={t('privacy.onlineStatus')}
            right="switch"
            switchValue={prefs.onlineStatusVisible}
            onSwitchChange={(value) => setPref('onlineStatusVisible', value)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="eye-off-outline"
            label={t('privacy.blurPhotos')}
            description={t('privacy.blurPhotosDesc')}
            right="switch"
            switchValue={prefs.blurPhotos}
            onSwitchChange={(value) => setPref('blurPhotos', value)}
          />
        </View>
      </FadeIn>

      <FadeIn delay={80}>
        <AccentHeading title={t('privacy.safetySection')} gradient={safeRamp} style={styles.sectionHeading} />
        <View style={styles.card}>
          <SettingsRow
            icon="hand-left-outline"
            label={t('privacy.blockedUsers')}
            description={String(blockedProfiles.length)}
            right="chevron"
            onPress={() => router.push('/blocked-users')}
          />
        </View>

        <View style={styles.tipsCard}>
          <View style={[styles.tipsHeader, rtl && styles.rowRtl]}>
            <View style={styles.tipsIcon}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
            </View>
            <Text style={[styles.tipsTitle, rtl && styles.rtlText]}>{t('privacy.safetyTipsTitle')}</Text>
          </View>
          {['privacy.safetyTip1', 'privacy.safetyTip2', 'privacy.safetyTip3'].map((key) => (
            <View key={key} style={[styles.tipRow, rtl && styles.rowRtl]}>
              <View style={styles.tipDiamond} />
              <Text style={[styles.tip, rtl && styles.rtlText]}>{t(key)}</Text>
            </View>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={160}>
        <AccentHeading
          title={t('privacy.accountSection')}
          gradient={[colors.danger, colors.plum]}
          style={styles.sectionHeading}
        />
        <View style={[styles.card, styles.dangerCard]}>
          <SettingsRow icon="trash-outline" label={t('privacy.deleteAccount')} right="chevron" onPress={onDeleteAccount} />
        </View>
      </FadeIn>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    firstSectionHeading: { marginBottom: spacing.sm },
    sectionHeading: { marginBottom: spacing.md, marginTop: spacing.lg },
    card: { ...cardSurface(colors), paddingVertical: 0, paddingBottom: 0, paddingHorizontal: spacing.md },
    dangerCard: { borderColor: withAlpha(colors.danger, 0.35) },
    rowRtl: { flexDirection: 'row-reverse' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    tipsCard: {
      backgroundColor: withAlpha(colors.success, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.success, 0.32),
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginTop: spacing.md,
    },
    tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    // An emerald seal: white disc, emerald rim.
    tipsIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipsTitle: { ...typography.h3, color: colors.textPrimary },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
    tipDiamond: {
      width: 6,
      height: 6,
      marginTop: 7,
      backgroundColor: colors.gold,
      transform: [{ rotate: '45deg' }],
    },
    tip: { ...typography.body, color: colors.textPrimary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
