import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { MainTabScreenProps } from '../../navigation/types';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/dashboard/StatCard';
import { mockEvents } from '../../data/mockEvents';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';
import { useDiscovery } from '../../store/DiscoveryContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useMatches } from '../../store/MatchesContext';
import { useFavorites } from '../../store/FavoritesContext';
import { usePrivacy } from '../../store/PrivacyContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { useDialog } from '../../store/DialogContext';
import { LinearGradient } from 'expo-linear-gradient';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { timeAgo } from '../../utils/time';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = MainTabScreenProps<'Explore'>;
type ExploreTab = 'forYou' | 'events' | 'history';
type ExploreProfile = (DiscoverProfile | RishtaListingProfile) & { kind: 'dating' | 'rishta' };

const TABS: { key: ExploreTab; labelKey: string }[] = [
  { key: 'forYou', labelKey: 'explore.forYou' },
  { key: 'events', labelKey: 'explore.events' },
  { key: 'history', labelKey: 'explore.myHistory' },
];

export function ExploreScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { blockedProfiles, matches } = useMatches();
  const { favorites } = useFavorites();
  const { prefs } = usePrivacy();
  const { history, clearHistory } = useViewHistory();
  const { confirm } = useDialog();
  const { datingProfiles, rishtaProfiles } = useDiscovery();
  const [tab, setTab] = useState<ExploreTab>('forYou');
  const [activeEvent, setActiveEvent] = useState<(typeof mockEvents)[number] | null>(null);
  const insets = useSafeAreaInsets();
  const onScroll = useHideTabBarOnScroll();

  const isPro = Boolean(user?.isExplorePlus);

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.sourceProfileId).filter(Boolean)),
    [blockedProfiles]
  );

  const combinedPool: ExploreProfile[] = useMemo(() => {
    const dating = oppositeGenderProfiles(datingProfiles, user?.gender)
      .filter((p) => !blockedProfileIds.has(p.id))
      .map((p) => ({ ...p, kind: 'dating' as const }));
    const rishta = oppositeGenderProfiles(rishtaProfiles, user?.gender)
      .filter((p) => !blockedProfileIds.has(p.id))
      .map((p) => ({ ...p, kind: 'rishta' as const }));
    return [...dating, ...rishta];
  }, [user?.gender, blockedProfileIds, datingProfiles, rishtaProfiles]);

  const likesInFilters = prefs.profileVisible ? combinedPool.slice(0, 4) : [];
  const currentlyAvailable = combinedPool.slice(4, 8);
  const justJoined = [...combinedPool].reverse().slice(0, 4);

  const openProfile = (profile: ExploreProfile) => {
    navigation.navigate('ProfileDetail', { kind: profile.kind, id: profile.id });
  };

  const onShareEvent = async (event: (typeof mockEvents)[number]) => {
    try {
      await Share.share({ message: t('explore.shareEventMessage', { title: event.title, city: event.city, date: event.dateLabel }) });
    } catch {
      // Dismissed — nothing to do.
    }
  };

  const onClearHistory = async () => {
    const confirmed = await confirm({
      title: t('explore.clearHistoryConfirmTitle'),
      message: t('explore.clearHistoryConfirmBody'),
      confirmLabel: t('explore.clearHistory'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) clearHistory();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text style={[styles.title, rtl && styles.rtlText]}>{t('explore.title')}</Text>

      <View style={styles.tabRow}>
        {TABS.map((tabDef) => {
          const active = tab === tabDef.key;
          return (
            <Pressable key={tabDef.key} onPress={() => setTab(tabDef.key)} style={styles.tabItem}>
              <Text style={[styles.tabLabel, active && { color: colors.teal }]}>{t(tabDef.labelKey)}</Text>
              {active && <View style={[styles.tabUnderline, { backgroundColor: colors.teal }]} />}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.lg }]}
      >
        {tab === 'forYou' && (
          <>
            <View style={styles.statsRow}>
              <StatCard icon="eye-outline" value={history.length} label={t('explore.myHistory')} tint={colors.teal} tintSoft={colors.tealSoft} onPress={() => setTab('history')} />
              <StatCard icon="heart-outline" value={favorites.length} label={t('dashboard.statsLikes')} tint={colors.dating} tintSoft={colors.datingSoft} />
              <StatCard icon="people-outline" value={matches.length} label={t('dashboard.statsMatches')} tint={colors.rishta} tintSoft={colors.rishtaSoft} />
            </View>

            {!isPro && likesInFilters.length > 0 && (
              <Pressable onPress={() => navigation.navigate('ExplorePlus')} style={styles.teaserCard}>
                <Image source={{ uri: likesInFilters[0].photos[0] }} style={styles.teaserImage} blurRadius={18} />
                <LinearGradient colors={['transparent', 'rgba(10,10,12,0.85)']} style={styles.teaserGradient}>
                  <View style={styles.teaserLockRow}>
                    <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                    <Text style={styles.teaserCount}>
                      {t('explore.likesInFilters')} · {likesInFilters.length}
                    </Text>
                  </View>
                  <Text style={styles.teaserHint}>{t('explore.premiumLockHint')}</Text>
                  <View style={styles.teaserButton}>
                    <Ionicons name="sparkles" size={14} color={colors.tealDark} />
                    <Text style={styles.teaserButtonText}>{t('explorePlus.upgrade')}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            )}

            {isPro && (
              <ProfileGridSection
                title={t('explore.likesInFilters')}
                emptyLabel={t('explore.likesInFiltersEmpty')}
                profiles={likesInFilters}
                locked={false}
                onPressProfile={openProfile}
                colors={colors}
                isDark={isDark}
                rtl={rtl}
              />
            )}

            <ProfileGridSection
              title={t('explore.currentlyAvailable')}
              emptyLabel={t('explore.currentlyAvailableEmpty')}
              profiles={currentlyAvailable}
              locked={!isPro}
              onPressLocked={() => navigation.navigate('ExplorePlus')}
              onPressProfile={openProfile}
              colors={colors}
              isDark={isDark}
              rtl={rtl}
            />

            <ProfileGridSection
              title={t('explore.justJoined')}
              emptyLabel={t('explore.justJoinedEmpty')}
              profiles={justJoined}
              locked={!isPro}
              onPressLocked={() => navigation.navigate('ExplorePlus')}
              onPressProfile={openProfile}
              colors={colors}
              isDark={isDark}
              rtl={rtl}
            />
          </>
        )}

        {tab === 'events' && (
          <View style={styles.eventList}>
            {mockEvents.map((event, index) => (
              <Animated.View key={event.id} entering={FadeInUp.delay(index * 60).duration(320)} style={styles.eventCard}>
                <Image source={{ uri: event.image }} style={styles.eventImage} />
                <View style={styles.eventBody}>
                  <Text style={[styles.eventTitle, rtl && styles.rtlText]}>{event.title}</Text>
                  <View style={styles.eventMetaRow}>
                    <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.eventMeta}>{event.city}</Text>
                    <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
                    <Text style={styles.eventMeta}>{event.dateLabel}</Text>
                  </View>
                  <View style={styles.eventActions}>
                    <Button label={t('explore.learnMore')} variant="secondary" onPress={() => setActiveEvent(event)} style={styles.eventActionButton} />
                    <Pressable onPress={() => onShareEvent(event)} style={styles.eventShareButton}>
                      <Ionicons name="share-outline" size={18} color={colors.teal} />
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {tab === 'history' && (
          <View>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={28} color={colors.textTertiary} />
                <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('explore.historyEmpty')}</Text>
              </View>
            ) : (
              <>
                {history.map((entry) => (
                  <Pressable
                    key={entry.id}
                    onPress={() => navigation.navigate('ProfileDetail', { kind: entry.kind, id: entry.id })}
                    style={styles.historyRow}
                  >
                    <Image source={{ uri: entry.photo }} style={styles.historyAvatar} />
                    <View style={styles.historyTextWrap}>
                      <Text style={[styles.historyName, rtl && styles.rtlText]}>{entry.name}, {entry.age}</Text>
                      <Text style={[styles.historyMeta, rtl && styles.rtlText]}>{t('explore.viewedAt', { time: timeAgo(entry.viewedAt) })}</Text>
                    </View>
                  </Pressable>
                ))}
                <Button label={t('explore.clearHistory')} variant="ghost" onPress={onClearHistory} style={styles.clearButton} />
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(activeEvent)} transparent animationType="fade" onRequestClose={() => setActiveEvent(null)}>
        <Pressable style={styles.eventModalOverlay} onPress={() => setActiveEvent(null)}>
          {activeEvent && (
            <Pressable style={styles.eventModalCard} onPress={(e) => e.stopPropagation()}>
              <Image source={{ uri: activeEvent.image }} style={styles.eventModalImage} />
              <View style={styles.eventModalBody}>
                <Text style={styles.eventModalTitle}>{activeEvent.title}</Text>
                <View style={styles.eventMetaRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.eventMeta}>{activeEvent.city}</Text>
                  <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
                  <Text style={styles.eventMeta}>{activeEvent.dateLabel}</Text>
                </View>
                <Text style={styles.eventModalDescription}>{activeEvent.description}</Text>
                <Button label={t('common.done')} onPress={() => setActiveEvent(null)} style={styles.eventModalCloseButton} />
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ProfileGridSection({
  title,
  emptyLabel,
  profiles,
  locked,
  onPressLocked,
  onPressProfile,
  colors,
  isDark,
  rtl,
}: {
  title: string;
  emptyLabel: string;
  profiles: ExploreProfile[];
  locked: boolean;
  onPressLocked?: () => void;
  onPressProfile: (profile: ExploreProfile) => void;
  colors: Palette;
  isDark: boolean;
  rtl: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useLanguage();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{title}</Text>
      {profiles.length === 0 ? (
        <Text style={[styles.sectionEmpty, rtl && styles.rtlText]}>{emptyLabel}</Text>
      ) : (
        <View style={styles.grid}>
          {profiles.map((profile) => (
            <Pressable
              key={profile.id}
              onPress={() => (locked ? onPressLocked?.() : onPressProfile(profile))}
              style={styles.gridCard}
            >
              <Image source={{ uri: profile.photos[0] }} style={styles.gridPhoto} />
              {locked ? (
                <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                    <Text style={styles.lockOverlayText}>{t('explorePlus.upgrade')}</Text>
                  </View>
                </BlurView>
              ) : (
                <View style={styles.gridNameWrap}>
                  <Text style={styles.gridName} numberOfLines={1}>{profile.name}, {profile.age}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    title: { ...typography.h1, color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabItem: { marginRight: spacing.lg, paddingBottom: spacing.sm },
    tabLabel: { ...typography.bodyBold, color: colors.textSecondary },
    tabUnderline: { height: 2, borderRadius: 1, marginTop: spacing.xs },
    content: { padding: spacing.lg },
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
    sectionEmpty: { ...typography.caption, color: colors.textTertiary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    gridCard: { width: '47%', aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.skeleton },
    gridPhoto: { width: '100%', height: '100%' },
    lockOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
    lockOverlayText: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
    gridNameWrap: { position: 'absolute', bottom: spacing.xs, left: spacing.xs, right: spacing.xs },
    gridName: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    teaserCard: {
      height: 180,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
      marginBottom: spacing.lg,
    },
    teaserImage: { ...StyleSheet.absoluteFillObject },
    teaserGradient: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: spacing.md,
    },
    teaserLockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    teaserCount: { ...typography.bodyBold, color: '#FFFFFF' },
    teaserHint: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 4, marginBottom: spacing.sm },
    teaserButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    teaserButtonText: { ...typography.label, color: colors.tealDark, fontWeight: '700' },
    eventList: { gap: spacing.lg },
    eventCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    eventImage: { width: '100%', height: 140, backgroundColor: colors.skeleton },
    eventBody: { padding: spacing.md },
    eventTitle: { ...typography.h3, color: colors.textPrimary },
    eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
    eventMeta: { ...typography.caption, color: colors.textSecondary },
    eventActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
    eventActionButton: { flex: 1 },
    eventShareButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    eventModalCard: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
    eventModalImage: { width: '100%', height: 160, backgroundColor: colors.skeleton },
    eventModalBody: { padding: spacing.lg },
    eventModalTitle: { ...typography.h2, color: colors.textPrimary },
    eventModalDescription: { ...typography.body, color: colors.textPrimary, marginTop: spacing.md },
    eventModalCloseButton: { marginTop: spacing.lg },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: spacing.xxl },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    historyAvatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.skeleton },
    historyTextWrap: { flex: 1 },
    historyName: { ...typography.bodyBold, color: colors.textPrimary },
    historyMeta: { ...typography.caption, color: colors.textTertiary },
    clearButton: { marginTop: spacing.md },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
