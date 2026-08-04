import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { MainTabScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { StatCard } from '../../components/dashboard/StatCard';
import { ActionCard } from '../../components/dashboard/ActionCard';
import { ProgressBar } from '../../components/dashboard/ProgressBar';
import { NotificationRow } from '../../components/dashboard/NotificationRow';
import { IconButton } from '../../components/common/IconButton';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useNotifications } from '../../store/NotificationContext';
import { useMatches } from '../../store/MatchesContext';
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

  if (!user) return null;
  const completion = profileCompletion(user);
  const recent = feed.slice(0, 3);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Animated.View entering={FadeInUp.duration(360)} style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {user.photos[0] ? (
            <Image source={{ uri: user.photos[0] }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={18} color={colors.textInverse} />
            </View>
          )}
          <View>
            <Text style={[styles.greetingSmall, rtl && styles.rtlText]}>{t('dashboard.greeting')}</Text>
            <Text style={[styles.greetingName, rtl && styles.rtlText]}>{user.fullName.split(' ')[0]}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton icon="settings-outline" onPress={() => navigation.navigate('Settings')} />
          <IconButton icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} badge={unreadCount} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(80).duration(360)} style={styles.completionCard}>
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
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(140).duration(360)} style={styles.statsRow}>
        <Pressable style={styles.statPressable} onPress={() => navigation.navigate('ExplorePlus')}>
          <StatCard icon="heart" value={28} label={t('dashboard.statsLikes')} tint={colors.dating} tintSoft={colors.datingSoft} />
        </Pressable>
        <StatCard icon="people" value={matches.length} label={t('dashboard.statsMatches')} tint={colors.rishta} tintSoft={colors.rishtaSoft} />
        <StatCard icon="eye" value={112} label={t('dashboard.statsViews')} tint={colors.teal} tintSoft={colors.tealSoft} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(360)} style={styles.section}>
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
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(260).duration(360)}>
        <LinearGradient colors={[colors.rishta, colors.plum]} style={styles.featureCard}>
          <Ionicons name="git-merge" size={22} color="#FFFFFF" />
          <Text style={styles.featureTitle}>{t('dashboard.moveToRishtaTitle')}</Text>
          <Text style={styles.featureBody}>{t('dashboard.moveToRishtaBody')}</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(320).duration(360)} style={styles.section}>
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
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(380).duration(360)} style={styles.comingSoonCard}>
        <Text style={[styles.comingSoonTitle, rtl && styles.rtlText]}>{t('dashboard.comingSoonTitle')}</Text>
        <Text style={[styles.comingSoonBody, rtl && styles.rtlText]}>{t('dashboard.comingSoonBody')}</Text>
      </Animated.View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.skeleton },
    avatarPlaceholder: { backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
    greetingSmall: { ...typography.caption, color: colors.textSecondary },
    greetingName: { ...typography.h3, color: colors.textPrimary },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    statPressable: { flex: 1 },
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
    comingSoonCard: {
      backgroundColor: colors.plumLight,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    comingSoonTitle: { ...typography.label, color: colors.plum, marginBottom: 4 },
    comingSoonBody: { ...typography.caption, color: colors.plum },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
