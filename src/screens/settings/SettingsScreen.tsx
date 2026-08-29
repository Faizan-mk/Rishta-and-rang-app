import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { SettingsRow } from '../../components/common/SettingsRow';
import { Button } from '../../components/Button';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme, ThemeMode } from '../../store/ThemeContext';
import { useNotifications } from '../../store/NotificationContext';
import { useDialog } from '../../store/DialogContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import type { NotificationPrefs } from '../../types/content';

const THEME_OPTIONS: { key: ThemeMode; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', labelKey: 'settings.light', icon: 'sunny-outline' },
  { key: 'dark', labelKey: 'settings.dark', icon: 'moon-outline' },
  { key: 'system', labelKey: 'settings.system', icon: 'phone-portrait-outline' },
];

const NOTIF_ROWS: { key: keyof NotificationPrefs; labelKey: string }[] = [
  { key: 'newMatches', labelKey: 'settings.notifNewMatches' },
  { key: 'messages', labelKey: 'settings.notifMessages' },
  { key: 'likes', labelKey: 'settings.notifLikes' },
  { key: 'rishtaRequests', labelKey: 'settings.notifRishtaRequests' },
  { key: 'productUpdates', labelKey: 'settings.notifProductUpdates' },
];

export function SettingsScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, language, setLanguage } = useLanguage();
  const { logout } = useAuth();
  const { prefs, setPref } = useNotifications();
  const { confirm } = useDialog();

  const onLogout = async () => {
    const confirmed = await confirm({
      title: t('profile.logOutConfirmTitle'),
      message: t('profile.logOutConfirmBody'),
      confirmLabel: t('profile.logOut'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) {
      logout();
    }
  };

  return (
    <ScreenContainer>
      <FadeIn><Text style={[styles.title, rtl && styles.rtlText]}>{t('settings.title')}</Text></FadeIn>

      <FadeIn delay={40}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('settings.appearance')}</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => {
            const selected = mode === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setMode(option.key)}
                style={[styles.themeOption, selected && styles.themeOptionSelected]}
              >
                <Ionicons name={option.icon} size={20} color={selected ? colors.teal : colors.textSecondary} />
                <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>{t(option.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      </FadeIn>

      <FadeIn delay={90}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('settings.language')}</Text>
        <View style={styles.themeRow}>
          <Pressable onPress={() => setLanguage('en')} style={[styles.themeOption, language === 'en' && styles.themeOptionSelected]}>
            <Text style={[styles.themeLabel, language === 'en' && styles.themeLabelSelected]}>{t('language.english')}</Text>
          </Pressable>
          <Pressable onPress={() => setLanguage('ur')} style={[styles.themeOption, language === 'ur' && styles.themeOptionSelected]}>
            <Text style={[styles.themeLabel, language === 'ur' && styles.themeLabelSelected]}>{t('language.urdu')}</Text>
          </Pressable>
          <Pressable onPress={() => setLanguage('roman')} style={[styles.themeOption, language === 'roman' && styles.themeOptionSelected]}>
            <Text style={[styles.themeLabel, language === 'roman' && styles.themeLabelSelected]}>{t('language.roman')}</Text>
          </Pressable>
        </View>
      </FadeIn>

      <FadeIn delay={140}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('settings.notificationsSection')}</Text>
        <View style={styles.card}>
          {NOTIF_ROWS.map((row, index) => (
            <React.Fragment key={row.key}>
              <SettingsRow
                label={t(row.labelKey)}
                right="switch"
                switchValue={prefs[row.key]}
                onSwitchChange={(value) => setPref(row.key, value)}
              />
              {index < NOTIF_ROWS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={190}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('settings.account')}</Text>
        <View style={styles.card}>
          <SettingsRow icon="sparkles-outline" label={t('settings.subscription')} right="chevron" onPress={() => router.push('/explore-plus')} />
          <View style={styles.divider} />
          <SettingsRow icon="heart-outline" label={t('profile.favorites')} right="chevron" onPress={() => router.push('/favorites')} />
          <View style={styles.divider} />
          <SettingsRow icon="shield-checkmark-outline" label={t('settings.privacy')} right="chevron" onPress={() => router.push('/privacy-safety')} />
          <View style={styles.divider} />
          <SettingsRow icon="help-circle-outline" label={t('settings.help')} right="chevron" onPress={() => router.push('/help-support')} />
          <View style={styles.divider} />
          <SettingsRow icon="document-text-outline" label={t('settings.legal')} right="chevron" onPress={() => router.push('/legal')} />
        </View>
      </FadeIn>

      <Button label={t('profile.logOut')} variant="danger" onPress={onLogout} style={styles.logout} />
      <Text style={styles.version}>{t('settings.version')}</Text>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
    themeRow: { flexDirection: 'row', gap: spacing.sm },
    themeOption: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    themeOptionSelected: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
    themeLabel: { ...typography.label, color: colors.textSecondary },
    themeLabelSelected: { color: colors.teal },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    logout: { marginTop: spacing.xl },
    version: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
