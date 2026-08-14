import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { MainTabScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { StatCard } from '../../components/dashboard/StatCard';
import { ActionCard } from '../../components/dashboard/ActionCard';
import { ProgressBar } from '../../components/dashboard/ProgressBar';
import { NotificationRow } from '../../components/dashboard/NotificationRow';
import { IconButton } from '../../components/common/IconButton';
import { FadeIn } from '../../components/common/FadeInUp';
import { Button } from '../../components/common/Button';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useNotifications } from '../../store/NotificationContext';
import { useMatches } from '../../store/MatchesContext';
import { useLikeLimit } from '../../store/LikeLimitContext';
import { usePrivacy } from '../../store/PrivacyContext';
import { mockDiscoverProfiles } from '../../data/mockDiscover';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { profileCompletion } from '../../utils/profileCompletion';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = MainTabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { feed, unreadCount } = useNotifications();
  const { matches } = useMatches();
  const { used, limit, isUnlimited } = useLikeLimit();
  const { prefs } = usePrivacy();

  if (!user) return null;
  const completion = profileCompletion(user);
  const recent = feed.slice(0, 3);
  // Demo engagement baseline — zeroed out while the profile is hidden from Discover/Rishta
  // (Privacy & safety → "Show my profile to others"), since a hidden profile can't be liked or viewed.
  const likesCount = prefs.profileVisible ? oppositeGenderProfiles(mockDiscoverProfiles, user.gender).length : 0;
  const viewsCount = prefs.profileVisible ? 112 : 0;

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <FadeIn style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {user.photos[0] ? (
            <Image source={{ uri: user.photos[0] }} style={[styles.avatar, user.isExplorePlus && styles.avatarPremium]} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, user.isExplorePlus && styles.avatarPremium]}>
              <Ionicons name="person" size={18} color={colors.textInverse} />
            </View>
          )}
          <View>
            <Text style={[styles.greetingSmall, rtl && styles.rtlText]}>{t('dashboard.greeting')}</Text>
            <Text style={[styles.greetingName, rtl && styles.rtlText]}>{user.fullName.split(' ')[0]}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} badge={unreadCount} />
          <IconButton icon="settings-outline" onPress={() => navigation.navigate('Settings')} />
        </View>
      </FadeIn>

      <FadeIn delay={80} style={styles.completionCard}>
        <View style={styles.completionHeader}>
          <Text style={[styles.completionLabel, rtl && styles.rtlText]}>{t('dashboard.profileStrength')}</Text>
          <Text style={styles.completionValue}>{completion}%</Text>
        </View>
        <ProgressBar progress={completion} />
        {completion < 100 && (
          <Pressable onPress={() => navigation.navigate('EditProfile')} style={styles.completionCta}>
            <Text style={styles.completionCtaText}>{t('dashboard.completeProfile')}</Text>
            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.teal} />
          </Pressable>
        )}
      </FadeIn>

      <FadeIn delay={140} style={styles.statsRow}>
        <StatCard
          icon="heart"
          value={likesCount}
          label={t('dashboard.statsLikes')}
          tint={colors.dating}
          tintSoft={colors.datingSoft}
          onPress={() => navigation.navigate('ExplorePlus')}
        />
        <StatCard icon="people" value={matches.length} label={t('dashboard.statsMatches')} tint={colors.rishta} tintSoft={colors.rishtaSoft} />
        <StatCard icon="eye" value={viewsCount} label={t('dashboard.statsViews')} tint={colors.teal} tintSoft={colors.tealSoft} />
      </FadeIn>

      <FadeIn delay={200} style={styles.section}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('dashboard.quickActions')}</Text>
        <View style={styles.actionsRow}>
          <ActionCard
            icon="flame"
            title={t('dashboard.startSwiping')}
            tint={colors.dating}
            tintSoft={colors.datingSoft}
            onPress={() => navigation.navigate('Discover')}
          />
          <ActionCard
            icon="people-circle"
            title={t('dashboard.browseRishta')}
            tint={colors.rishta}
            tintSoft={colors.rishtaSoft}
            onPress={() => navigation.navigate('Rishta')}
          />
          <ActionCard
            icon="person-circle"
            title={t('dashboard.editProfile')}
            tint={colors.teal}
            tintSoft={colors.tealSoft}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <ActionCard
            icon="heart-circle"
            title={t('profile.favorites')}
            tint={colors.dating}
            tintSoft={colors.datingSoft}
            onPress={() => navigation.navigate('Favorites')}
          />
        </View>
      </FadeIn>

      <FadeIn delay={260}>
        <LinearGradient colors={[colors.rishta, colors.plum]} style={styles.featureCard}>
          <Ionicons name="git-merge" size={22} color="#FFFFFF" />
          <Text style={styles.featureTitle}>{t('dashboard.moveToRishtaTitle')}</Text>
          <Text style={styles.featureBody}>{t('dashboard.moveToRishtaBody')}</Text>
        </LinearGradient>
      </FadeIn>

      <FadeIn delay={320} style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('dashboard.recentActivity')}</Text>
          <Pressable onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>
        <View style={styles.activityCard}>
          {recent.map((item) => (
            <NotificationRow key={item.id} item={item} onPress={() => navigation.navigate('Notifications')} />
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={380} style={styles.likesWidget}>
        {isUnlimited ? (
          <LinearGradient colors={[colors.gold, colors.dating]} style={styles.likesWidgetGradient}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            <Text style={styles.likesWidgetTitlePro}>{t('dashboard.proActiveTitle')}</Text>
            <Text style={styles.likesWidgetBodyPro}>{t('dashboard.proActiveBody')}</Text>
            <Pressable onPress={() => navigation.navigate('ExplorePlus')} style={styles.manageLink}>
              <Text style={styles.manageLinkText}>{t('explorePlus.manageSubscription')}</Text>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={14} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>
        ) : (
          <View style={styles.likesWidgetCard}>
            <Text style={[styles.likesWidgetTitle, rtl && styles.rtlText]}>{t('dashboard.likesWidgetTitle')}</Text>
            <Text style={[styles.likesWidgetBody, rtl && styles.rtlText]}>{t('dashboard.likesUsed', { used, limit })}</Text>
            <ProgressBar progress={Math.min((used / limit) * 100, 100)} color={colors.dating} />
            <Button
              label={t('dashboard.upgradeCta')}
              variant="secondary"
              onPress={() => navigation.navigate('ExplorePlus')}
              style={styles.upgradeCta}
            />
          </View>
        )}
      </FadeIn>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.skeleton, borderWidth: 2, borderColor: 'transparent' },
    avatarPremium: { borderColor: colors.gold },
    avatarPlaceholder: { backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
    greetingSmall: { ...typography.caption, color: colors.textSecondary },
    greetingName: { ...typography.h3, color: colors.textPrimary },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    completionCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    completionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    completionLabel: { ...typography.label, color: colors.textSecondary },
    completionValue: { ...typography.label, color: colors.teal },
    completionCta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 4 },
    completionCtaText: { ...typography.caption, color: colors.teal, fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    section: { marginBottom: spacing.lg },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
    seeAll: { ...typography.caption, color: colors.teal, fontWeight: '700' },
    actionsRow: { flexDirection: 'row', gap: spacing.sm },
    featureCard: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
    featureTitle: { ...typography.h3, color: '#FFFFFF', marginTop: spacing.sm },
    featureBody: { ...typography.body, color: 'rgba(255,255,255,0.9)', marginTop: spacing.xs },
    activityCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    likesWidget: { marginBottom: spacing.lg },
    likesWidgetCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    likesWidgetTitle: { ...typography.label, color: colors.textPrimary, marginBottom: 4 },
    likesWidgetBody: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
    upgradeCta: { marginTop: spacing.md },
    likesWidgetGradient: { borderRadius: radius.lg, padding: spacing.lg },
    likesWidgetTitlePro: { ...typography.h3, color: '#FFFFFF', marginTop: spacing.sm },
    likesWidgetBodyPro: { ...typography.body, color: 'rgba(255,255,255,0.9)', marginTop: spacing.xs },
    manageLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
    manageLinkText: { ...typography.label, color: '#FFFFFF' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
