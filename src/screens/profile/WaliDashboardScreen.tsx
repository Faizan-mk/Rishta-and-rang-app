import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
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
      <Ionicons name="git-merge" size={16} color={colors.rishta} />
      <Text style={[styles.matchName, rtl && styles.rtlText]}>{item.name}</Text>
    </Animated.View>
  );

  return (
    <ScreenContainer scroll={!hasWali}>
      {!hasWali ? (
        <FadeIn>
          <Text style={[styles.title, rtl && styles.rtlText]}>{t('wali.title')}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('wali.explainer')}</Text>

          <TextField label={t('wali.name')} value={name} onChangeText={setName} placeholder={t('wali.namePlaceholder')} />
          <TextField
            label={t('wali.contact')}
            value={contact}
            onChangeText={setContact}
            placeholder={t('wali.contactPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}
          <Button label={t('wali.sendInvite')} onPress={onInvite} loading={saving} style={styles.submit} />
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

            <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('wali.sharedActivity')}</Text>
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
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    submit: { marginTop: spacing.sm },
    waliCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
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
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
    list: { flex: 1 },
    matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    matchName: { ...typography.body, color: colors.textPrimary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
