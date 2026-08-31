import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AccentHeading } from '../../components/common/AccentHeading';
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
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import type { NotificationPrefs } from '../../types/content';
import type { AppLanguage } from '../../types/user';

const THEME_OPTIONS: { key: ThemeMode; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', labelKey: 'settings.light', icon: 'sunny-outline' },
  { key: 'dark', labelKey: 'settings.dark', icon: 'moon-outline' },
  { key: 'system', labelKey: 'settings.system', icon: 'phone-portrait-outline' },
];

const LANGUAGE_OPTIONS: { key: AppLanguage; labelKey: string }[] = [
  { key: 'en', labelKey: 'language.english' },
  { key: 'ur', labelKey: 'language.urdu' },
  { key: 'roman', labelKey: 'language.roman' },
];

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

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
  const { user, logout } = useAuth();
  const accent = modeAccent(colors, user?.activeMode ?? 'dating');
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
      <FadeIn>
        <AccentHeading size="screen" title={t('settings.title')} gradient={accent.ramp} style={styles.heading} />
      </FadeIn>

      <FadeIn delay={40}>
        <AccentHeading title={t('settings.appearance')} gradient={accent.duo} style={styles.sectionHeading} />
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => {
            const selected = mode === option.key;
            if (selected) {
              return (
                <Pressable key={option.key} onPress={() => setMode(option.key)} style={styles.themeSlot}>
                  <LinearGradient
                    colors={accent.ramp}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={[styles.themeOption, glow(accent.primary, 0.5, 14, 6)]}
                  >
                    <Ionicons name={option.icon} size={20} color="#FFFFFF" />
                    <Text style={[styles.themeLabel, styles.themeLabelSelected]}>{t(option.labelKey)}</Text>
                  </LinearGradient>
                </Pressable>
              );
            }
            return (
              <Pressable key={option.key} onPress={() => setMode(option.key)} style={styles.themeSlot}>
                <View style={[styles.themeOption, styles.themeOptionIdle]}>
                  <Ionicons name={option.icon} size={20} color={colors.textSecondary} />
                  <Text style={styles.themeLabel}>{t(option.labelKey)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </FadeIn>

      <FadeIn delay={90}>
        <AccentHeading title={t('settings.language')} gradient={accent.duo} style={styles.sectionHeading} />
        <View style={styles.themeRow}>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = language === option.key;
            if (selected) {
              return (
                <Pressable key={option.key} onPress={() => setLanguage(option.key)} style={styles.themeSlot}>
                  <LinearGradient
                    colors={accent.ramp}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={[styles.themeOption, glow(accent.primary, 0.5, 14, 6)]}
                  >
                    <Text style={[styles.themeLabel, styles.themeLabelSelected]}>{t(option.labelKey)}</Text>
                  </LinearGradient>
                </Pressable>
              );
            }
            return (
              <Pressable key={option.key} onPress={() => setLanguage(option.key)} style={styles.themeSlot}>
                <View style={[styles.themeOption, styles.themeOptionIdle]}>
                  <Text style={styles.themeLabel}>{t(option.labelKey)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </FadeIn>

      <FadeIn delay={140}>
        <AccentHeading title={t('settings.notificationsSection')} gradient={accent.duo} style={styles.sectionHeading} />
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
        <AccentHeading title={t('settings.account')} gradient={accent.duo} style={styles.sectionHeading} />
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
    heading: { marginBottom: spacing.lg },
    sectionHeading: { marginBottom: spacing.sm, marginTop: spacing.lg },
    themeRow: { flexDirection: 'row', gap: spacing.sm },
    themeSlot: { flex: 1 },
    themeOption: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    themeOptionIdle: {
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
    },
    themeLabel: { ...typography.label, color: colors.textSecondary, fontWeight: '700' },
    themeLabelSelected: { color: '#FFFFFF', fontWeight: '800' },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.md,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    logout: { marginTop: spacing.xl },
    version: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
