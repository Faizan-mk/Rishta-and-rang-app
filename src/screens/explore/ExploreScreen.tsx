import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { MainTabScreenProps } from '../../navigation/types';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { Button } from '../../components/common/Button';
import { SmartImage } from '../../components/common/SmartImage';
import { BrowseFiltersSheet } from '../../components/discover/BrowseSheets';
import {
  DEFAULT_BROWSE_FILTERS,
  countActiveFilters,
  type BrowseFilters,
} from '../../components/discover/browseOptions';
import { likesService, type LikeReceived } from '../../services/likesService';
import { mockEvents } from '../../data/mockEvents';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';
import { useDiscovery } from '../../store/DiscoveryContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useMatches } from '../../store/MatchesContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { useDialog } from '../../store/DialogContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { timeAgo } from '../../utils/time';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';

type Props = MainTabScreenProps<'Explore'>;
type ExploreTab = 'forYou' | 'events' | 'history';
type ExploreProfile = (DiscoverProfile | RishtaListingProfile) & { kind: 'dating' | 'rishta' };

const TABS: { key: ExploreTab; labelKey: string }[] = [
  { key: 'forYou', labelKey: 'explore.forYou' },
  { key: 'events', labelKey: 'explore.events' },
  { key: 'history', labelKey: 'explore.myHistory' },
];

// How many cards each themed row shows.
const ROW_SIZE = 4;

function timestamp(iso?: string): number {
  return iso ? new Date(iso).getTime() : 0;
}

// Grid browsing of the same member pool the Home deck swipes through: free for
// everyone (the roadmap's "basic match suggestions"), with only the paid
// "who liked you" list behind Explore+.
export function ExploreScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { blockedProfiles } = useMatches();
  const { history, clearHistory } = useViewHistory();
  const { confirm } = useDialog();
  const { datingProfiles, rishtaProfiles } = useDiscovery();
  const [tab, setTab] = useState<ExploreTab>('forYou');
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [likes, setLikes] = useState<LikeReceived[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [activeEvent, setActiveEvent] = useState<(typeof mockEvents)[number] | null>(null);
  const insets = useSafeAreaInsets();
  const onScroll = useHideTabBarOnScroll();

  const isPro = Boolean(user?.isExplorePlus);
  const mode = user?.activeMode ?? 'dating';
  const activeFilters = countActiveFilters(filters);

  // Real data, not a slice of the deck: these are the members who actually
  // liked this profile (mirrored onto users/{me}/likesReceived when they do).
  const loadLikes = useCallback(async () => {
    if (!user) return;
    setLoadingLikes(true);
    try {
      setLikes(await likesService.fetchLikesReceived(user.id));
    } catch {
      // Offline — leave whatever is already on screen.
    } finally {
      setLoadingLikes(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadLikes();
  }, [loadLikes]);

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.sourceProfileId).filter(Boolean)),
    [blockedProfiles]
  );

  // One pool, matching the mode the member is browsing in.
  const pool: ExploreProfile[] = useMemo(() => {
    const source: (DiscoverProfile | RishtaListingProfile)[] =
      mode === 'dating' ? datingProfiles : rishtaProfiles;
    return oppositeGenderProfiles(source, user?.gender)
      .filter((p) => !blockedProfileIds.has(p.id))
      .map((p) => ({ ...p, kind: mode }));
  }, [mode, datingProfiles, rishtaProfiles, user?.gender, blockedProfileIds]);

  const filtered = useMemo(() => {
    let list = pool.filter((p) => p.age >= filters.ageMin && p.age <= filters.ageMax);
    if (filters.city) {
      const city = filters.city.toLowerCase();
      list = list.filter((p) => p.city?.toLowerCase() === city);
    }
    if (filters.intent) list = list.filter((p) => p.intent === filters.intent);
    if (mode === 'rishta' && filters.sect) {
      const sect = filters.sect.toLowerCase();
      list = list.filter((p) => p.sect?.toLowerCase() === sect);
    }
    if (mode === 'rishta' && filters.readiness) list = list.filter((p) => p.readiness === filters.readiness);
    if (filters.verifiedOnly) list = list.filter((p) => p.selfieVerified || p.bureauVerified);
    return list;
  }, [pool, filters, mode]);

  const newMembers = useMemo(
    () => [...filtered].sort((a, b) => timestamp(b.joinedAt) - timestamp(a.joinedAt)).slice(0, ROW_SIZE),
    [filtered]
  );
  const recentlyActive = useMemo(
    () =>
      filtered
        .filter((p) => p.lastActiveAt)
        .sort((a, b) => timestamp(b.lastActiveAt) - timestamp(a.lastActiveAt))
        .slice(0, ROW_SIZE),
    [filtered]
  );

  const openProfile = (profile: ExploreProfile) => {
    navigation.navigate('ProfileDetail', { kind: profile.kind, id: profile.id });
  };

  const onShareEvent = async (event: (typeof mockEvents)[number]) => {
    try {
      await Share.share({
        message: t('explore.shareEventMessage', { title: event.title, city: event.city, date: event.dateLabel }),
      });
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
      <View style={[styles.header, rtl && styles.rowRtl]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, rtl && styles.rtlText]}>{t('explore.title')}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('explore.subtitle')}</Text>
        </View>
        {tab === 'forYou' && (
          <Pressable
            onPress={() => setFiltersVisible(true)}
            style={[styles.filterChip, activeFilters > 0 && styles.filterChipActive]}
          >
            <Ionicons name="options-outline" size={16} color={activeFilters > 0 ? colors.teal : colors.textSecondary} />
            <Text style={[styles.filterLabel, activeFilters > 0 && styles.filterLabelActive]}>
              {t('discover.filters')}
            </Text>
            {activeFilters > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{activeFilters}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      <View style={[styles.tabRow, rtl && styles.rowRtl]}>
        {TABS.map((tabDef) => {
          const active = tab === tabDef.key;
          return (
            <Pressable key={tabDef.key} onPress={() => setTab(tabDef.key)} style={styles.tabItem}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(tabDef.labelKey)}</Text>
              {active && <View style={styles.tabUnderline} />}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={loadingLikes} onRefresh={loadLikes} tintColor={colors.teal} colors={[colors.teal]} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.lg }]}
      >
        {tab === 'forYou' && (
          <>
            {/* The one paid unlock in V1: free members see the count, not the faces. */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('explore.whoLikedYou')}</Text>
              {likes.length === 0 ? (
                <Text style={[styles.sectionEmpty, rtl && styles.rtlText]}>{t('explore.whoLikedYouEmpty')}</Text>
              ) : isPro ? (
                <View style={styles.grid}>
                  {likes.map((like) => (
                    <Pressable
                      key={like.id}
                      onPress={() => navigation.navigate('ProfileDetail', { kind: like.kind, id: like.id })}
                      style={styles.gridCard}
                    >
                      <SmartImage uri={like.photo} name={like.name} style={styles.gridPhoto} size={30} />
                      <View style={styles.gridCaption}>
                        <Text style={styles.gridName} numberOfLines={1}>
                          {like.name}, {like.age}
                        </Text>
                        <Text style={styles.gridMeta} numberOfLines={1}>
                          {like.city}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Pressable onPress={() => navigation.navigate('ExplorePlus')} style={styles.lockedCard}>
                  <Image source={{ uri: likes[0].photo }} style={styles.lockedImage} blurRadius={22} />
                  <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                  <View style={styles.lockedBody}>
                    <Ionicons name="lock-closed" size={20} color={colors.teal} />
                    <Text style={styles.lockedCount}>
                      {likes.length === 1
                        ? t('explore.whoLikedYouLockedOne')
                        : t('explore.whoLikedYouLocked', { count: likes.length })}
                    </Text>
                    <Text style={styles.lockedHint}>{t('explore.premiumLockHint')}</Text>
                    <View style={styles.lockedButton}>
                      <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                      <Text style={styles.lockedButtonText}>{t('explorePlus.upgrade')}</Text>
                    </View>
                  </View>
                </Pressable>
              )}
            </View>

            <ProfileRow
              title={t('explore.newMembers')}
              emptyLabel={t('explore.newMembersEmpty')}
              profiles={newMembers}
              captionFor={(p) => (p.joinedAt ? t('explore.joinedAt', { time: timeAgo(p.joinedAt) }) : p.city)}
              onPressProfile={openProfile}
              colors={colors}
              rtl={rtl}
            />

            <ProfileRow
              title={t('explore.recentlyActive')}
              emptyLabel={t('explore.recentlyActiveEmpty')}
              profiles={recentlyActive}
              captionFor={(p) => (p.lastActiveAt ? t('explore.activeAt', { time: timeAgo(p.lastActiveAt) }) : p.city)}
              onPressProfile={openProfile}
              colors={colors}
              rtl={rtl}
            />

            <ProfileRow
              title={t('explore.allProfiles')}
              emptyLabel={t('explore.allProfilesEmpty')}
              profiles={filtered}
              captionFor={(p) => p.city}
              onPressProfile={openProfile}
              colors={colors}
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
                  <View style={[styles.eventMetaRow, rtl && styles.rowRtl]}>
                    <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.eventMeta}>{event.city}</Text>
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color={colors.textSecondary}
                      style={styles.eventMetaIcon}
                    />
                    <Text style={styles.eventMeta}>{event.dateLabel}</Text>
                  </View>
                  <View style={[styles.eventActions, rtl && styles.rowRtl]}>
                    <Button
                      label={t('explore.learnMore')}
                      variant="secondary"
                      onPress={() => setActiveEvent(event)}
                      style={styles.eventActionButton}
                    />
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
          <View style={styles.section}>
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
                    style={[styles.historyRow, rtl && styles.rowRtl]}
                  >
                    <SmartImage uri={entry.photo} name={entry.name} style={styles.historyAvatar} size={16} />
                    <View style={styles.historyTextWrap}>
                      <Text style={[styles.historyName, rtl && styles.rtlText]}>
                        {entry.name}, {entry.age}
                      </Text>
                      <Text style={[styles.historyMeta, rtl && styles.rtlText]}>
                        {t('explore.viewedAt', { time: timeAgo(entry.viewedAt) })}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <Button
                  label={t('explore.clearHistory')}
                  variant="ghost"
                  onPress={onClearHistory}
                  style={styles.clearButton}
                />
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
                  <Ionicons
                    name="calendar-outline"
                    size={13}
                    color={colors.textSecondary}
                    style={styles.eventMetaIcon}
                  />
                  <Text style={styles.eventMeta}>{activeEvent.dateLabel}</Text>
                </View>
                <Text style={styles.eventModalDescription}>{activeEvent.description}</Text>
                <Button
                  label={t('common.done')}
                  onPress={() => setActiveEvent(null)}
                  style={styles.eventModalCloseButton}
                />
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <BrowseFiltersSheet
        visible={filtersVisible}
        filters={filters}
        mode={mode}
        onChange={setFilters}
        onClose={() => setFiltersVisible(false)}
      />
    </SafeAreaView>
  );
}

function ProfileRow({
  title,
  emptyLabel,
  profiles,
  captionFor,
  onPressProfile,
  colors,
  rtl,
}: {
  title: string;
  emptyLabel: string;
  profiles: ExploreProfile[];
  captionFor: (profile: ExploreProfile) => string;
  onPressProfile: (profile: ExploreProfile) => void;
  colors: Palette;
  rtl: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{title}</Text>
      {profiles.length === 0 ? (
        <Text style={[styles.sectionEmpty, rtl && styles.rtlText]}>{emptyLabel}</Text>
      ) : (
        <View style={styles.grid}>
          {profiles.map((profile, index) => (
            <Animated.View key={profile.id} entering={FadeInUp.delay(index * 50).duration(280)} style={styles.gridSlot}>
              <Pressable onPress={() => onPressProfile(profile)} style={styles.gridCardFill}>
                <SmartImage uri={profile.photos[0]} name={profile.name} style={styles.gridPhoto} size={30} />
                {profile.selfieVerified && (
                  <View style={styles.gridVerified}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.teal} />
                  </View>
                )}
                <View style={styles.gridCaption}>
                  <Text style={styles.gridName} numberOfLines={1}>
                    {profile.name}, {profile.age}
                  </Text>
                  <Text style={styles.gridMeta} numberOfLines={1}>
                    {captionFor(profile)}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

// Shared card shape: the likes grid sizes itself, the profile rows are sized by
// their animated wrapper instead.
const CARD_SHAPE = {
  aspectRatio: 3 / 4,
  borderRadius: radius.md,
  overflow: 'hidden' as const,
  justifyContent: 'flex-end' as const,
};

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    rowRtl: { flexDirection: 'row-reverse' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerText: { flex: 1 },
    title: { ...typography.h1, color: colors.textPrimary },
    subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterChipActive: { backgroundColor: colors.tealSoft },
    filterLabel: { ...typography.label, color: colors.textSecondary, fontWeight: '700' },
    filterLabelActive: { color: colors.teal },
    countPill: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countPillText: { color: '#FFFFFF', fontSize: scaleFont(10), fontWeight: '800' },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
    tabLabel: { ...typography.label, color: colors.textSecondary, fontWeight: '700' },
    tabLabelActive: { color: colors.teal },
    tabUnderline: {
      position: 'absolute',
      bottom: 0,
      height: 2,
      width: '70%',
      borderRadius: 1,
      backgroundColor: colors.teal,
    },
    content: { paddingHorizontal: spacing.md },
    section: { marginTop: spacing.lg },
    sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
    sectionEmpty: { ...typography.caption, color: colors.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    gridSlot: { width: '47%' },
    gridCard: { ...CARD_SHAPE, width: '47%', backgroundColor: colors.skeleton },
    gridCardFill: { ...CARD_SHAPE, width: '100%', backgroundColor: colors.skeleton },
    gridPhoto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    gridVerified: {
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      padding: 2,
    },
    gridCaption: { backgroundColor: 'rgba(10,10,12,0.55)', paddingHorizontal: spacing.sm, paddingVertical: 6 },
    gridName: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
    gridMeta: { fontSize: scaleFont(11), color: 'rgba(255,255,255,0.85)' },
    lockedCard: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    lockedImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    lockedBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
    lockedCount: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
    lockedHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
    lockedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.teal,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
    },
    lockedButtonText: { ...typography.label, color: '#FFFFFF', fontWeight: '700' },
    eventList: { marginTop: spacing.lg, gap: spacing.md },
    eventCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    eventImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.skeleton },
    eventBody: { padding: spacing.md, gap: spacing.xs },
    eventTitle: { ...typography.h3, color: colors.textPrimary },
    eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    eventMetaIcon: { marginLeft: spacing.sm },
    eventMeta: { ...typography.caption, color: colors.textSecondary },
    eventActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    eventActionButton: { flex: 1 },
    eventShareButton: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    eventModalCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
    eventModalImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.skeleton },
    eventModalBody: { padding: spacing.md, gap: spacing.sm },
    eventModalTitle: { ...typography.h3, color: colors.textPrimary },
    eventModalDescription: { ...typography.body, color: colors.textSecondary },
    eventModalCloseButton: { marginTop: spacing.xs },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    historyAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.skeleton },
    historyTextWrap: { flex: 1 },
    historyName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
    historyMeta: { ...typography.caption, color: colors.textSecondary },
    clearButton: { marginTop: spacing.md },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
