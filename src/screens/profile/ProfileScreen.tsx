import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { AccentHeading } from '../../components/common/AccentHeading';
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
import { vocabularyLabel } from '../../i18n/vocabulary';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useNotifications } from '../../store/NotificationContext';
import { ageFromDob } from '../../utils/date';
import { profileCompletion } from '../../utils/profileCompletion';
import { FEATURE_BUREAU } from '../../config/features';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha, type Gradient } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

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
  const completion = profileCompletion(user);
  const memberSince = new Date(user.createdAt).getFullYear();
  const accent = modeAccent(colors, user.activeMode);

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
      {/* The banner wears the member's own mode colours, so the menu opens in the
          same world their deck is in. */}
      <LinearGradient colors={accent.ramp} start={GRADIENT_START} end={GRADIENT_END} style={styles.banner}>
        <View style={styles.bannerGlowA} pointerEvents="none" />
        <View style={styles.bannerGlowB} pointerEvents="none" />
        <Animated.View entering={FadeInUp.delay(60).duration(320)} style={styles.bannerActions}>
          <IconButton
            icon="notifications-outline"
            onPress={() => router.push('/notifications')}
            background="rgba(255,255,255,0.22)"
            color="#FFFFFF"
            badge={unreadCount}
            style={styles.noBorder}
          />
          <IconButton
            icon="settings-outline"
            onPress={() => router.push('/settings')}
            background="rgba(255,255,255,0.22)"
            color="#FFFFFF"
            style={styles.noBorder}
          />
        </Animated.View>
      </LinearGradient>

      <Animated.View entering={FadeInUp.duration(360)} style={styles.headerCard}>
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={user.isExplorePlus ? PREMIUM_RING : accent.ramp}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={[styles.avatarRing, glow(user.isExplorePlus ? colors.gold : accent.primary, 0.5, 18, 8)]}
          >
            {user.photos[0] ? (
              <Image source={{ uri: user.photos[0] }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={28} color={colors.textInverse} />
              </View>
            )}
          </LinearGradient>
          {user.selfieVerified && (
            <View style={styles.photoDot} accessibilityLabel={t('profile.photoAdded')}>
              <Ionicons name="camera" size={11} color={colors.textInverse} />
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          {/* The member's own name, as they typed it. Age belongs on the cards
              other people browse, not on your own profile — seeing ", 22"
              appended to a name you entered without it reads as the app having
              got your name wrong. */}
          <Text style={[styles.name, rtl && styles.rtlText]}>{user.fullName}</Text>
        </View>
        <View style={[styles.metaRow, rtl && styles.rowRtl]}>
          <Ionicons name="location" size={13} color={accent.primary} />
          <Text style={[styles.meta, { color: accent.primary }, rtl && styles.rtlText]}>{vocabularyLabel(user.city, t)}</Text>
        </View>

        <View style={styles.badgeRow}>
          {user.isExplorePlus && (
            <Pressable onPress={() => router.push('/explore-plus')}>
              <Badge label={t('profile.premiumBadge')} tone="premium" icon="sparkles" />
            </Pressable>
          )}
          <Badge label={user.selfieVerified ? t('profile.photoAdded') : t('profile.noPhotoYet')} tone={user.selfieVerified ? 'success' : 'neutral'} />
          <Badge label={t(`intent.${user.intent}Title`)} tone="neutral" />
        </View>

        <Pressable onPress={() => router.push('/edit-profile')} style={styles.editButton}>
          <LinearGradient
            colors={accent.ramp}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={[styles.editButtonFill, glow(accent.primary, 0.5, 16, 7)]}
          >
            <Ionicons name="create-outline" size={17} color="#FFFFFF" />
            <Text style={styles.editButtonLabel}>{t('profile.editProfile')}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <View style={styles.statsRow}>
        <StatTile
          icon="pie-chart"
          tint={colors.teal}
          value={`${completion}%`}
          label={t('profile.completion')}
          colors={colors}
        />
        <StatTile
          icon="images"
          tint={colors.plum}
          value={String(user.photos.length)}
          label={t('photos.title')}
          colors={colors}
        />
        <StatTile
          icon="ribbon"
          tint={colors.gold}
          value={String(memberSince)}
          label={t('profile.memberSince')}
          colors={colors}
        />
      </View>

      {/* Intent replaces the old Friend/Rishta switch: picking Matrimonial puts
          the member on the rishta deck, anything else on the dating deck. */}
      <View style={styles.section}>
        <AccentHeading
          title={t('profile.intentSection')}
          subtitle={t('profile.intentHint')}
          gradient={accent.duo}
          style={styles.sectionHeading}
        />
        <View style={styles.optionCard}>
          {INTENT_OPTIONS.map((option, index) => {
            const selected = user.intent === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setIntent(option.key)}
                style={[
                  styles.optionRow,
                  index > 0 && styles.optionRowBorder,
                  selected && { backgroundColor: withAlpha(accent.primary, 0.08) },
                  rtl && styles.rowRtl,
                ]}
              >
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.optionTitle,
                      selected && { color: accent.primary },
                      rtl && styles.rtlText,
                    ]}
                  >
                    {t(option.labelKey)}
                  </Text>
                  <Text style={[styles.optionDesc, rtl && styles.rtlText]}>{t(`intent.${option.key}Desc`)}</Text>
                </View>
                {selected ? (
                  <LinearGradient
                    colors={accent.duo}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={[styles.radioOn, glow(accent.primary, 0.7, 10, 4)]}
                  >
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  </LinearGradient>
                ) : (
                  <View style={styles.radioOff} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <AccentHeading
          title={t('profile.readiness')}
          subtitle={t('profile.readinessHint')}
          gradient={accent.duo}
          style={styles.sectionHeading}
        />
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
          <AccentHeading title={t('profile.about')} gradient={accent.duo} style={styles.sectionHeading} />
          <View style={styles.bioCard}>
            <Text style={[styles.body, rtl && styles.rtlText]}>{user.bio}</Text>
          </View>
        </View>
      ) : null}

      {user.activeMode === 'dating' ? (
        <View style={styles.section}>
          <AccentHeading title={t('profile.vibeTags')} gradient={accent.duo} style={styles.sectionHeading} />
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
          <AccentHeading
            title={t('profile.rishtaDetails')}
            gradient={accent.duo}
            style={styles.sectionHeading}
            right={<Button label={t('common.edit')} variant="ghost" onPress={() => router.push('/rishta-profile')} />}
          />
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
          <QuickLinkRow icon="heart" tint={colors.dating} label={t('profile.favorites')} onPress={() => router.push('/favorites')} rtl={rtl} />
          <QuickLinkRow icon="sparkles" tint={colors.gold} label={t('profile.subscription')} onPress={() => router.push('/explore-plus')} rtl={rtl} />
          <QuickLinkRow icon="notifications" tint={colors.plum} label={t('profile.notifications')} onPress={() => router.push('/notifications')} rtl={rtl} />
          <QuickLinkRow icon="settings" tint={colors.teal} label={t('profile.settings')} onPress={() => router.push('/settings')} rtl={rtl} last />
        </View>
      </View>

      <View style={styles.section}>
        <AccentHeading title={t('profile.verificationSection')} gradient={accent.duo} style={styles.sectionHeading} />
        <View style={styles.quickLinks}>
          <SettingsRow
            icon="card-outline"
            label={t('profile.cnic')}
            description={user.cnicVerified ? t('profile.cnicPhotoSubmitted') : t('profile.cnicNoPhoto')}
            right="chevron"
            onPress={() => router.push('/cnic-verification')}
          />
          {FEATURE_BUREAU && (
            <>
              <View style={styles.rowDivider} />
              <SettingsRow
                icon="shield-checkmark-outline"
                label={t('profile.bureau')}
                description={requestingBureau ? t('bureau.requesting') : user.bureauVerified ? t('profile.verified') : t('profile.notVerified')}
                right="chevron"
                onPress={onRequestBureau}
              />
            </>
          )}
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

// Each stat gets its own tinted tile and icon, so the three numbers read as
// three different facts instead of one undifferentiated strip.
function StatTile({
  icon,
  tint,
  value,
  label,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
  colors: Palette;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.statTile, { backgroundColor: withAlpha(tint, 0.1), borderColor: withAlpha(tint, 0.28) }]}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[styles.statValue, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
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

function QuickLinkRow({
  icon,
  tint,
  label,
  onPress,
  rtl,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  onPress: () => void;
  rtl: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        quickStyles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        rtl && { flexDirection: 'row-reverse' },
      ]}
    >
      <View style={[quickStyles.iconTile, { backgroundColor: withAlpha(tint, 0.14) }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={[quickStyles.label, { color: colors.textPrimary }, rtl && quickStyles.rtlText]}>{label}</Text>
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

// Gold ring for paying members — the one place the palette's premium colour
// outranks the member's own mode colour.
const PREMIUM_RING: Gradient = ['#F5C451', '#E0913A', '#C97C2E'];

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  label: { ...typography.body },
  value: { ...typography.bodyBold, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});

const quickStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, gap: spacing.sm },
  iconTile: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.body, flex: 1, fontWeight: '600' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    banner: {
      height: 104,
      borderRadius: radius.lg,
      marginTop: spacing.sm,
      alignItems: 'flex-end',
      padding: spacing.sm,
      overflow: 'hidden',
    },
    // Two blown-out highlights inside the banner, so the gradient reads as lit
    // rather than as a flat two-colour sweep.
    bannerGlowA: {
      position: 'absolute',
      top: -50,
      left: -20,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    bannerGlowB: {
      position: 'absolute',
      bottom: -70,
      right: 30,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    bannerActions: { flexDirection: 'row', gap: spacing.xs },
    noBorder: { borderWidth: 0 },
    headerCard: { alignItems: 'center', marginTop: -46, paddingHorizontal: spacing.md },
    avatarWrap: { position: 'relative' },
    avatarRing: { width: 92, height: 92, borderRadius: 46, padding: 4 },
    avatar: { width: '100%', height: '100%', borderRadius: 42, backgroundColor: colors.skeleton },
    avatarPlaceholder: { backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
    // A camera, not a tick, and in neutral ink rather than success green: this
    // only says a photo was added. A green check beside a face reads as
    // "identity confirmed", which nothing in the app has actually done.
    photoDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: withAlpha(colors.textPrimary, 0.55),
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameRow: { marginTop: spacing.sm },
    name: { ...typography.h2, color: colors.textPrimary, fontWeight: '800' },
    rowRtl: { flexDirection: 'row-reverse' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    meta: { ...typography.caption, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
    editButton: { alignSelf: 'stretch', marginTop: spacing.md },
    editButtonFill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
    },
    editButtonLabel: { ...typography.bodyBold, color: '#FFFFFF', fontWeight: '800' },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    statTile: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    statValue: { ...typography.h3, fontWeight: '800' },
    statLabel: { ...typography.caption, color: colors.textSecondary },
    section: { marginTop: spacing.lg },
    sectionHeading: { marginBottom: spacing.sm },
    optionCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
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
    optionDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    radioOn: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    radioOff: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
    body: { ...typography.body, color: colors.textPrimary },
    bioCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.md,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    detailCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.md,
    },
    quickLinks: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.md,
    },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    logout: { marginTop: spacing.xl, marginBottom: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
