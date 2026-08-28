import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStackScreenProps } from '../../navigation/types';
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
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'PrivacySafety'>;

export function PrivacySafetyScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { deleteAccount } = useAuth();
  const { confirm, notify } = useDialog();
  const { prefs, setPref } = usePrivacy();
  const { blockedProfiles } = useMatches();

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
        <Text style={[styles.sectionTitle, rtl && styles.rtlText, styles.firstSection]}>{t('privacy.visibilitySection')}</Text>
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
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('privacy.safetySection')}</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="hand-left-outline"
            label={t('privacy.blockedUsers')}
            description={String(blockedProfiles.length)}
            right="chevron"
            onPress={() => navigation.navigate('BlockedUsers')}
          />
        </View>

        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="shield-checkmark" size={18} color={colors.success} />
            <Text style={[styles.tipsTitle, rtl && styles.rtlText]}>{t('privacy.safetyTipsTitle')}</Text>
          </View>
          <Text style={[styles.tip, rtl && styles.rtlText]}>• {t('privacy.safetyTip1')}</Text>
          <Text style={[styles.tip, rtl && styles.rtlText]}>• {t('privacy.safetyTip2')}</Text>
          <Text style={[styles.tip, rtl && styles.rtlText]}>• {t('privacy.safetyTip3')}</Text>
        </View>
      </FadeIn>

      <FadeIn delay={160}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('privacy.accountSection')}</Text>
        <View style={styles.card}>
          <SettingsRow icon="trash-outline" label={t('privacy.deleteAccount')} right="chevron" onPress={onDeleteAccount} />
        </View>
      </FadeIn>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    firstSection: { marginTop: 0 },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    tipsCard: {
      backgroundColor: colors.successSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    tipsTitle: { ...typography.label, color: colors.success },
    tip: { ...typography.caption, color: colors.textPrimary, marginBottom: 4 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
