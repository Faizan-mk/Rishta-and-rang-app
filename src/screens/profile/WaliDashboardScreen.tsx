import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/Button';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useMatches } from '../../store/MatchesContext';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import type { Match } from '../../types/content';

export function WaliDashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser } = useAuth();
  const { notify, confirm } = useDialog();
  const { matches } = useMatches();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  // The wali flow belongs to the rishta side of the app, whichever deck the
  // member is currently browsing.
  const accent = modeAccent(colors, 'rishta');
  const hasWali = Boolean(user.waliContact);
  const sharedActivity = matches.filter((m) => m.movedToRishta);

  const onInvite = async () => {
    if (!name.trim() || !contact.trim()) {
      setError(t('wali.missingFields'));
      return;
    }
    setError(null);
    setSaving(true);
    await updateUser({ ...user, waliName: name.trim(), waliContact: contact.trim(), waliInvitedAt: new Date().toISOString() });
    setSaving(false);
    await notify({ title: t('wali.invitedTitle'), message: t('wali.invitedBody', { name: name.trim() }) });
  };

  const onRemove = async () => {
    const confirmed = await confirm({
      title: t('wali.removeConfirmTitle'),
      message: t('wali.removeConfirmBody'),
      confirmLabel: t('wali.removeConfirmLabel'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    await updateUser({ ...user, waliName: undefined, waliContact: undefined, waliInvitedAt: undefined });
  };

  const renderMatch = ({ item, index }: { item: Match; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)} style={styles.matchRow}>
      <View style={styles.matchIcon}>
        <Ionicons name="git-merge" size={14} color="#FFFFFF" />
      </View>
      <Text style={[styles.matchName, rtl && styles.rtlText]}>{item.name}</Text>
    </Animated.View>
  );

  return (
    <ScreenContainer scroll={!hasWali}>
      {!hasWali ? (
        <FadeIn>
          <LinearGradient
            colors={accent.ramp}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, glow(accent.primary, 0.45, 20, 9)]}
          >
            <View style={styles.heroGlow} pointerEvents="none" />
            <View style={styles.heroIcon}>
              <Ionicons name="people" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.heroTitle, rtl && styles.rtlText]}>{t('wali.title')}</Text>
            <Text style={[styles.heroSubtitle, rtl && styles.rtlText]}>{t('wali.explainer')}</Text>
          </LinearGradient>

          <TextField label={t('wali.name')} value={name} onChangeText={setName} placeholder={t('wali.namePlaceholder')} />
          <TextField
            label={t('wali.contact')}
            value={contact}
            onChangeText={setContact}
            placeholder={t('wali.contactPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
            </View>
          ) : null}
          <Button
            label={t('wali.sendInvite')}
            onPress={onInvite}
            loading={saving}
            gradient={accent.ramp}
            style={styles.submit}
          />
        </FadeIn>
      ) : (
        <View style={styles.flex}>
          <FadeIn>
            <View style={styles.waliCard}>
              <View style={styles.waliRow}>
                <Text style={[styles.waliLabel, rtl && styles.rtlText]}>{t('wali.name')}</Text>
                <Text style={styles.waliValue}>{user.waliName}</Text>
              </View>
              <View style={styles.waliRow}>
                <Text style={[styles.waliLabel, rtl && styles.rtlText]}>{t('wali.contact')}</Text>
                <Text style={styles.waliValue}>{user.waliContact}</Text>
              </View>
            </View>
            <Button label={t('wali.removeWali')} variant="danger" onPress={onRemove} style={styles.removeButton} />

            <AccentHeading title={t('wali.sharedActivity')} gradient={accent.duo} style={styles.sectionHeading} />
          </FadeIn>
          <FlatList
            data={sharedActivity}
            keyExtractor={(item) => item.id}
            renderItem={renderMatch}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            style={styles.list}
            ListEmptyComponent={
              <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('wali.sharedActivityEmpty')}</Text>
            }
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.xs,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      top: -60,
      right: -30,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    heroTitle: { ...typography.h1, color: '#FFFFFF', fontWeight: '800' },
    heroSubtitle: { ...typography.body, color: 'rgba(255,255,255,0.9)' },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: withAlpha(colors.danger, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.35),
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    errorText: { ...typography.caption, color: colors.danger, fontWeight: '700', flexShrink: 1 },
    submit: { marginTop: spacing.sm },
    waliCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    waliRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    waliLabel: { ...typography.body, color: colors.textSecondary },
    waliValue: { ...typography.bodyBold, color: colors.textPrimary },
    removeButton: { marginBottom: spacing.lg },
    sectionHeading: { marginBottom: spacing.sm },
    list: { flex: 1 },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    matchIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.rishta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
    // The rows are cards now, so the list is spaced rather than ruled.
    divider: { height: spacing.sm },
    emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
