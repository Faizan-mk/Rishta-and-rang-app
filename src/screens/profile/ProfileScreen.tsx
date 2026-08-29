import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { Badge } from '../../components/common/Badge';
import { Chip } from '../../components/common/Chip';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/common/IconButton';
import { SettingsRow } from '../../components/common/SettingsRow';
import { INTENT_OPTIONS, READINESS_OPTIONS } from '../../components/discover/browseOptions';
import {
  AboutMeSection,
  FaithSection,
  FuturePlansSection,
  EducationCareerSection,
  LanguagesBackgroundSection,
  VerificationSection,
  IntroMediaSection,
} from '../../components/discover/ProfileDetailSections';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useNotifications } from '../../store/NotificationContext';
import { ageFromDob } from '../../utils/date';
import { profileCompletion } from '../../utils/profileCompletion';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

export function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser, setIntent, setReadiness, logout } = useAuth();
  const { confirm, notify } = useDialog();
  const { unreadCount } = useNotifications();
  const [requestingBureau, setRequestingBureau] = useState(false);
  const insets = useSafeAreaInsets();
  const onScroll = useHideTabBarOnScroll();

  if (!user) return null;

  // The shared profile-detail sections (built for browsing other people's profiles)
  // read a BrowseProfile shape — adapt the signed-in user's own record into that
  // shape so the exact same components render their own extended details here.
  const browseProfile = {
    ...user,
    name: user.fullName,
    age: ageFromDob(user.dob) ?? 0,
    religion: user.rishta.religion || undefined,
    sect: user.rishta.sect || undefined,
  };
  const age = ageFromDob(user.dob);
  const completion = profileCompletion(user);
  const memberSince = new Date(user.createdAt).getFullYear();

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

  const onRequestBureau = async () => {
    if (user.bureauVerified) {
      await notify({ title: t('profile.bureau'), message: t('bureau.alreadyVerifiedBody') });
      return;
    }
    const confirmed = await confirm({
      title: t('bureau.confirmTitle'),
      message: t('bureau.confirmBody'),
      confirmLabel: t('bureau.confirmLabel'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    setRequestingBureau(true);
    await updateUser({ ...user, bureauVerified: true });
    setRequestingBureau(false);
    await notify({ title: t('bureau.verifiedTitle'), message: t('bureau.verifiedBody') });
  };

  return (
    <ScreenContainer
      edges={['top']}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.lg }}
    >
      <LinearGradient colors={[colors.tealDark, colors.teal]} style={styles.banner}>
        <Animated.View entering={FadeInUp.delay(60).duration(320)} style={styles.bannerActions}>
          <IconButton
            icon="notifications-outline"
            onPress={() => router.push('/notifications')}
            background="rgba(255,255,255,0.2)"
            color="#FFFFFF"
            badge={unreadCount}
            style={styles.noBorder}
          />
          <IconButton
            icon="settings-outline"
            onPress={() => router.push('/settings')}
            background="rgba(255,255,255,0.2)"
            color="#FFFFFF"
            style={styles.noBorder}
          />
        </Animated.View>
      </LinearGradient>

      <Animated.View entering={FadeInUp.duration(360)} style={styles.headerCard}>
        <View style={styles.avatarWrap}>
          {user.photos[0] ? (
            <Image source={{ uri: user.photos[0] }} style={[styles.avatar, user.isExplorePlus && styles.avatarPremium]} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, user.isExplorePlus && styles.avatarPremium]}>
              <Ionicons name="person" size={28} color={colors.textInverse} />
            </View>
          )}
          {user.selfieVerified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={[styles.name, rtl && styles.rtlText]}>
            {user.fullName}
            {age ? `, ${age}` : ''}
          </Text>
        </View>
        <Text style={[styles.meta, rtl && styles.rtlText]}>{user.city}</Text>

        <View style={styles.badgeRow}>
          {user.isExplorePlus && (
            <Pressable onPress={() => router.push('/explore-plus')}>
              <Badge label={t('profile.premiumBadge')} tone="premium" icon="sparkles" />
            </Pressable>
          )}
          <Badge label={user.selfieVerified ? t('profile.verified') : t('profile.notVerified')} tone={user.selfieVerified ? 'success' : 'neutral'} />
          <Badge label={t(`intent.${user.intent}Title`)} tone="neutral" />
        </View>

        <Button label={t('profile.editProfile')} variant="secondary" onPress={() => router.push('/edit-profile')} style={styles.editButton} />
      </Animated.View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completion}%</Text>
          <Text style={styles.statLabel}>{t('profile.completion')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user.photos.length}</Text>
          <Text style={styles.statLabel}>{t('photos.title')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{memberSince}</Text>
          <Text style={styles.statLabel}>{t('profile.memberSince')}</Text>
        </View>
      </View>

      {/* Intent replaces the old Friend/Rishta switch: picking Matrimonial puts
          the member on the rishta deck, anything else on the dating deck. */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.intentSection')}</Text>
        <Text style={[styles.sectionHint, rtl && styles.rtlText]}>{t('profile.intentHint')}</Text>
        <View style={styles.optionCard}>
          {INTENT_OPTIONS.map((option, index) => {
            const selected = user.intent === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setIntent(option.key)}
                style={[styles.optionRow, index > 0 && styles.optionRowBorder, rtl && styles.rowRtl]}
              >
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, selected && styles.optionTitleSelected, rtl && styles.rtlText]}>
                    {t(option.labelKey)}
                  </Text>
                  <Text style={[styles.optionDesc, rtl && styles.rtlText]}>{t(`intent.${option.key}Desc`)}</Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.teal : colors.textTertiary}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.readiness')}</Text>
        <Text style={[styles.sectionHint, rtl && styles.rtlText]}>{t('profile.readinessHint')}</Text>
        <View style={styles.chipRow}>
          {READINESS_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={t(option.labelKey)}
              tone="rishta"
              selected={user.rishta.readiness === option.key}
              onPress={() => setReadiness(option.key)}
            />
          ))}
        </View>
      </View>

      {user.bio ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.about')}</Text>
          <Text style={[styles.body, rtl && styles.rtlText]}>{user.bio}</Text>
        </View>
      ) : null}

      {user.activeMode === 'dating' ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.vibeTags')}</Text>
          <View style={styles.chipRow}>
            {user.dating.vibeTags.length === 0 ? (
              <Text style={[styles.body, rtl && styles.rtlText]}>—</Text>
            ) : (
              user.dating.vibeTags.map((tag) => <Chip key={tag} label={tag} tone="dating" selected />)
            )}
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.rishtaDetails')}</Text>
            <Button label={t('common.edit')} variant="ghost" onPress={() => router.push('/rishta-profile')} />
          </View>
          <View style={styles.detailCard}>
            <ProfileRow label={t('profile.religion')} value={user.rishta.religion || '—'} rtl={rtl} />
            <ProfileRow label={t('profile.sect')} value={user.rishta.sect || '—'} rtl={rtl} />
            <ProfileRow label={t('profile.familyBackground')} value={user.rishta.familyBackground || '—'} rtl={rtl} />
            <ProfileRow label={t('profile.education')} value={user.rishta.education || '—'} rtl={rtl} last />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <IntroMediaSection profile={browseProfile} />
        <AboutMeSection profile={browseProfile} />
        <FaithSection profile={browseProfile} />
        <FuturePlansSection profile={browseProfile} />
        <EducationCareerSection profile={browseProfile} />
        <LanguagesBackgroundSection profile={browseProfile} />
        <VerificationSection profile={browseProfile} />
      </View>

      <View style={styles.section}>
        <View style={styles.quickLinks}>
          <QuickLinkRow icon="heart-outline" label={t('profile.favorites')} onPress={() => router.push('/favorites')} rtl={rtl} />
          <QuickLinkRow icon="sparkles-outline" label={t('profile.subscription')} onPress={() => router.push('/explore-plus')} rtl={rtl} />
          <QuickLinkRow icon="notifications-outline" label={t('profile.notifications')} onPress={() => router.push('/notifications')} rtl={rtl} />
          <QuickLinkRow icon="settings-outline" label={t('profile.settings')} onPress={() => router.push('/settings')} rtl={rtl} last />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.verificationSection')}</Text>
        <View style={styles.quickLinks}>
          <SettingsRow
            icon="card-outline"
            label={t('profile.cnic')}
            description={user.cnicVerified ? t('profile.verified') : t('profile.notVerified')}
            right="chevron"
            onPress={() => router.push('/cnic-verification')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            label={t('profile.bureau')}
            description={requestingBureau ? t('bureau.requesting') : user.bureauVerified ? t('profile.verified') : t('profile.notVerified')}
            right="chevron"
            onPress={onRequestBureau}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="people-outline"
            label={t('profile.wali')}
            description={user.waliContact ? t('wali.statusInvited', { name: user.waliName ?? '' }) : t('wali.statusNotSet')}
            right="chevron"
            onPress={() => router.push('/wali-dashboard')}
          />
        </View>
      </View>

      <Button label={t('profile.logOut')} variant="danger" onPress={onLogout} style={styles.logout} />
    </ScreenContainer>
  );
}

function ProfileRow({ label, value, rtl, last }: { label: string; value: string; rtl: boolean; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        detailStyles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
        rtl && { flexDirection: 'row-reverse' },
      ]}
    >
      <Text style={[detailStyles.label, { color: colors.textSecondary }, rtl && detailStyles.rtlText]}>{label}</Text>
      <Text style={[detailStyles.value, { color: colors.textPrimary }, rtl && detailStyles.rtlText]}>{value}</Text>
    </View>
  );
}

function QuickLinkRow({ icon, label, onPress, rtl, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; rtl: boolean; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[quickStyles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rtl && { flexDirection: 'row-reverse' }]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={[quickStyles.label, { color: colors.textPrimary }, rtl && quickStyles.rtlText]}>{label}</Text>
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  label: { ...typography.body },
  value: { ...typography.bodyBold, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});

const quickStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  label: { ...typography.body, flex: 1 },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    banner: { height: 88, borderRadius: radius.lg, marginTop: spacing.sm, alignItems: 'flex-end', padding: spacing.sm },
    bannerActions: { flexDirection: 'row', gap: spacing.xs },
    noBorder: { borderWidth: 0 },
    headerCard: { alignItems: 'center', marginTop: -40, paddingHorizontal: spacing.md },
    avatarWrap: { position: 'relative' },
    avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.skeleton },
    avatarPremium: { borderColor: colors.gold },
    avatarPlaceholder: { backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
    verifiedDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameRow: { marginTop: spacing.sm },
    name: { ...typography.h2, color: colors.textPrimary },
    meta: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
    badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    editButton: { marginTop: spacing.md, alignSelf: 'stretch' },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: colors.border },
    statValue: { ...typography.h3, color: colors.textPrimary },
    statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    section: { marginTop: spacing.lg },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    optionCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    optionRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
    optionText: { flex: 1 },
    optionTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
    optionTitleSelected: { color: colors.teal },
    optionDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    rowRtl: { flexDirection: 'row-reverse' },
    sectionHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: -spacing.xs },
    sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase' },
    body: { ...typography.body, color: colors.textPrimary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    quickLinks: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    logout: { marginTop: spacing.xl, marginBottom: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
