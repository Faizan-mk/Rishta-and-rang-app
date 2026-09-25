import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { Button } from '../../components/Button';
import { AccentHeading } from '../../components/common/AccentHeading';
import { AuroraBackground } from '../../components/common/AuroraBackground';
import { SmartImage } from '../../components/common/SmartImage';
import { BrowseFiltersSheet } from '../../components/discover/BrowseSheets';
import {
  DEFAULT_BROWSE_FILTERS,
  countActiveFilters,
  type BrowseFilters,
} from '../../components/discover/browseOptions';
import { likesService, type LikeReceived } from '../../services/likesService';
import { mockEvents } from '../../data/mockEvents';
import { FEATURE_EVENTS } from '../../config/features';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';
import { useDiscovery } from '../../store/DiscoveryContext';
import { useLanguage } from '../../store/LanguageContext';
import { vocabularyLabel } from '../../i18n/vocabulary';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useMatches } from '../../store/MatchesContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { useDialog } from '../../store/DialogContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { timeAgo } from '../../utils/time';
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, modeAccent, withAlpha, type ModeAccent } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

type ExploreTab = 'forYou' | 'events' | 'history';
type ExploreProfile = (DiscoverProfile | RishtaListingProfile) & { kind: 'dating' | 'rishta' };

const TABS: { key: ExploreTab; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'forYou', labelKey: 'explore.forYou', icon: 'sparkles' },
  // Events tab hidden behind FEATURE_EVENTS flag for V1 — out of V1 roadmap scope.
  // When enabled, real event data must come from the backend, not mockEvents.
  ...(FEATURE_EVENTS ? ([{ key: 'events', labelKey: 'explore.events', icon: 'calendar' }] as const) : []),
  { key: 'history', labelKey: 'explore.myHistory', icon: 'time' },
];

// How many cards each themed row shows.
const ROW_SIZE = 4;

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
const SCRIM_START = { x: 0, y: 0 } as const;
const SCRIM_END = { x: 0, y: 1 } as const;

function timestamp(iso?: string): number {
  return iso ? new Date(iso).getTime() : 0;
}

// Grid browsing of the same member pool the Home deck swipes through: free for
// everyone (the roadmap's "basic match suggestions"), with only the paid
// "who liked you" list behind Explore+.
export function ExploreScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { rishtaProfileIds, blockedProfiles } = useMatches();
  const { history, clearHistory } = useViewHistory();
  const { confirm } = useDialog();
  const { datingProfiles, rishtaProfiles, loadMore } = useDiscovery();

  // Within a screen's height of the bottom counts as "reached it", so the next
  // page is asked for before the member is staring at the end of the grid.
  const onReachedBottom = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height * 2 >= contentSize.height) loadMore();
  };
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
  const accent = modeAccent(colors, mode);
  const activeFilters = countActiveFilters(filters, mode);

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
    () => new Set(blockedProfiles.map((b) => b.id)),
    [blockedProfiles]
  );

  // One pool, matching the mode the member is browsing in.
  const pool: ExploreProfile[] = useMemo(() => {
    const source: (DiscoverProfile | RishtaListingProfile)[] =
      mode === 'dating' ? datingProfiles : rishtaProfiles;
    return oppositeGenderProfiles(source, user?.gender)
      .filter((p) => !blockedProfileIds.has(p.id))
      // Same rule as the Home deck: a thread that moved to Rishta takes that
      // member out of the Friends pool.
      .filter((p) => mode === 'rishta' || !rishtaProfileIds.has(p.id))
      .map((p) => ({ ...p, kind: mode }));
  }, [mode, datingProfiles, rishtaProfiles, user?.gender, blockedProfileIds, rishtaProfileIds]);

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
    router.push({ pathname: '/profile-detail', params: { kind: profile.kind, id: profile.id } });
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
      <AuroraBackground colors={colors} mode={mode} />

      <View style={styles.header}>
        <AccentHeading
          size="screen"
          title={t('explore.title')}
          subtitle={t('explore.subtitle')}
          gradient={accent.ramp}
          right={
            tab === 'forYou' ? (
              <Pressable
                onPress={() => setFiltersVisible(true)}
                style={[styles.filterChip, activeFilters > 0 && styles.filterChipActive]}
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={activeFilters > 0 ? colors.teal : colors.textSecondary}
                />
                <Text style={[styles.filterLabel, activeFilters > 0 && styles.filterLabelActive]}>
                  {t('discover.filters')}
                </Text>
                {activeFilters > 0 && (
                  <View style={[styles.countPill, glow(colors.teal, 0.7, 8, 4)]}>
                    <Text style={styles.countPillText}>{activeFilters}</Text>
                  </View>
                )}
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {/* Segmented pills rather than an underline: the lit pill says which tab
          you're on from the corner of the eye, an underline doesn't. */}
      <View style={[styles.tabRow, rtl && styles.rowRtl]}>
        {TABS.map((tabDef) => {
          const active = tab === tabDef.key;
          if (active) {
            return (
              <Pressable key={tabDef.key} onPress={() => setTab(tabDef.key)} style={styles.tabItem}>
                <LinearGradient
                  colors={accent.ramp}
                  start={GRADIENT_START}
                  end={GRADIENT_END}
                  style={[styles.tabPill, glow(accent.primary, 0.5, 12, 6)]}
                >
                  <Ionicons name={tabDef.icon} size={14} color="#FFFFFF" />
                  <Text style={styles.tabLabelActive} numberOfLines={1}>
                    {t(tabDef.labelKey)}
                  </Text>
                </LinearGradient>
              </Pressable>
            );
          }
          return (
            <Pressable key={tabDef.key} onPress={() => setTab(tabDef.key)} style={styles.tabItem}>
              <View style={styles.tabPillIdle}>
                <Ionicons name={tabDef.icon} size={14} color={colors.textTertiary} />
                <Text style={styles.tabLabel} numberOfLines={1}>
                  {t(tabDef.labelKey)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // The grid is paged the same way the swipe deck is; reaching the bottom
        // is what asks for the next page.
        onMomentumScrollEnd={onReachedBottom}
        refreshControl={
          <RefreshControl refreshing={loadingLikes} onRefresh={loadLikes} tintColor={colors.teal} colors={[colors.teal]} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.lg }]}
      >
        {tab === 'forYou' && (
          <>
            {/* The one paid unlock in V1: free members see the count, not the faces. */}
            <View style={styles.section}>
              <AccentHeading title={t('explore.whoLikedYou')} gradient={accent.duo} style={styles.sectionHeading} />
              {likes.length === 0 ? (
                <Text style={[styles.sectionEmpty, rtl && styles.rtlText]}>{t('explore.whoLikedYouEmpty')}</Text>
              ) : isPro ? (
                <View style={styles.grid}>
                  {likes.map((like) => (
                    <View key={like.id} style={styles.gridSlot}>
                      <PhotoTile
                        uri={like.photo}
                        name={like.name}
                        title={like.name}
                        caption={vocabularyLabel(like.city, t)}
                        accent={accent}
                        colors={colors}
                        onPress={() =>
                          router.push({ pathname: '/profile-detail', params: { kind: like.kind, id: like.id } })
                        }
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <Pressable onPress={() => router.push('/explore-plus')} style={[styles.lockedCard, glow(accent.primary, 0.35, 18, 8)]}>
                  <Image source={{ uri: likes[0].photo }} style={styles.lockedImage} blurRadius={22} />
                  <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={[withAlpha(accent.primary, 0.35), withAlpha(accent.secondary, 0.2), 'transparent']}
                    start={SCRIM_END}
                    end={SCRIM_START}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.lockedBody}>
                    <LinearGradient
                      colors={accent.ramp}
                      start={GRADIENT_START}
                      end={GRADIENT_END}
                      style={[styles.lockedOrb, glow(accent.primary, 0.6, 16, 8)]}
                    >
                      <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.lockedCount}>
                      {likes.length === 1
                        ? t('explore.whoLikedYouLockedOne')
                        : t('explore.whoLikedYouLocked', { count: likes.length })}
                    </Text>
                    <Text style={styles.lockedHint}>{t('explore.premiumLockHint')}</Text>
                    <LinearGradient
                      colors={accent.ramp}
                      start={GRADIENT_START}
                      end={GRADIENT_END}
                      style={[styles.lockedButton, glow(accent.primary, 0.6, 14, 6)]}
                    >
                      <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                      <Text style={styles.lockedButtonText}>{t('explorePlus.upgrade')}</Text>
                    </LinearGradient>
                  </View>
                </Pressable>
              )}
            </View>

            <ProfileRow
              title={t('explore.newMembers')}
              emptyLabel={t('explore.newMembersEmpty')}
              profiles={newMembers}
              captionFor={(p) => (p.joinedAt ? t('explore.joinedAt', { time: timeAgo(p.joinedAt, t) }) : vocabularyLabel(p.city, t))}
              onPressProfile={openProfile}
              colors={colors}
              accent={accent}
              rtl={rtl}
            />

            <ProfileRow
              title={t('explore.recentlyActive')}
              emptyLabel={t('explore.recentlyActiveEmpty')}
              profiles={recentlyActive}
              captionFor={(p) => (p.lastActiveAt ? t('explore.activeAt', { time: timeAgo(p.lastActiveAt, t) }) : vocabularyLabel(p.city, t))}
              onPressProfile={openProfile}
              colors={colors}
              accent={accent}
              rtl={rtl}
            />

            <ProfileRow
              title={t('explore.allProfiles')}
              emptyLabel={t('explore.allProfilesEmpty')}
              profiles={filtered}
              captionFor={(p) => vocabularyLabel(p.city, t)}
              onPressProfile={openProfile}
              colors={colors}
              accent={accent}
              rtl={rtl}
            />
          </>
        )}

        {tab === 'events' && (
          <View style={styles.eventList}>
            {mockEvents.map((event, index) => (
              <Animated.View
                key={event.id}
                entering={FadeInUp.delay(index * 60).duration(320)}
                style={[styles.eventCard, glow(accent.primary, 0.25, 16, 6)]}
              >
                <View style={styles.eventImageWrap}>
                  <Image source={{ uri: event.image }} style={styles.eventImage} />
                  <LinearGradient
                    colors={['transparent', withAlpha(accent.primary, 0.35), 'rgba(10,10,12,0.72)']}
                    start={SCRIM_START}
                    end={SCRIM_END}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <Text style={[styles.eventTitle, rtl && styles.rtlText]} numberOfLines={2}>
                    {event.title}
                  </Text>
                </View>
                <View style={styles.eventBody}>
                  <View style={[styles.eventMetaRow, rtl && styles.rowRtl]}>
                    <View style={[styles.eventTag, { backgroundColor: withAlpha(colors.teal, 0.12) }]}>
                      <Ionicons name="location" size={12} color={colors.teal} />
                      <Text style={[styles.eventTagText, { color: colors.teal }]}>{vocabularyLabel(event.city, t)}</Text>
                    </View>
                    <View style={[styles.eventTag, { backgroundColor: withAlpha(colors.gold, 0.14) }]}>
                      <Ionicons name="calendar" size={12} color={colors.gold} />
                      <Text style={[styles.eventTagText, { color: colors.gold }]}>{event.dateLabel}</Text>
                    </View>
                  </View>
                  <View style={[styles.eventActions, rtl && styles.rowRtl]}>
                    <Pressable onPress={() => setActiveEvent(event)} style={styles.eventActionButton}>
                      <LinearGradient
                        colors={accent.ramp}
                        start={GRADIENT_START}
                        end={GRADIENT_END}
                        style={[styles.eventCta, glow(accent.primary, 0.5, 12, 6)]}
                      >
                        <Text style={styles.eventCtaText}>{t('explore.learnMore')}</Text>
                      </LinearGradient>
                    </Pressable>
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
                <LinearGradient
                  colors={accent.ramp}
                  start={GRADIENT_START}
                  end={GRADIENT_END}
                  style={[styles.emptyOrb, glow(accent.primary, 0.5, 22, 10)]}
                >
                  <Ionicons name="time" size={30} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('explore.historyEmpty')}</Text>
              </View>
            ) : (
              <>
                {history.map((entry, index) => (
                  <Animated.View key={entry.id} entering={FadeInUp.delay(Math.min(index * 40, 240)).duration(280)}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/profile-detail', params: { kind: entry.kind, id: entry.id } })}
                      style={[styles.historyRow, rtl && styles.rowRtl]}
                    >
                      <LinearGradient
                        colors={accent.ramp}
                        start={GRADIENT_START}
                        end={GRADIENT_END}
                        style={styles.historyAvatarRing}
                      >
                        <SmartImage uri={entry.photo} name={entry.name} style={styles.historyAvatar} size={16} />
                      </LinearGradient>
                      <View style={styles.historyTextWrap}>
                        <Text style={[styles.historyName, rtl && styles.rtlText]}>
                          {entry.name}
                        </Text>
                        <Text style={[styles.historyMeta, rtl && styles.rtlText]}>
                          {t('explore.viewedAt', { time: timeAgo(entry.viewedAt, t) })}
                        </Text>
                      </View>
                      <Ionicons
                        name={rtl ? 'chevron-back' : 'chevron-forward'}
                        size={16}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  </Animated.View>
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
              <View style={styles.eventImageWrap}>
                <Image source={{ uri: activeEvent.image }} style={styles.eventModalImage} />
                <LinearGradient
                  colors={['transparent', withAlpha(accent.primary, 0.3), 'rgba(10,10,12,0.7)']}
                  start={SCRIM_START}
                  end={SCRIM_END}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {activeEvent.title}
                </Text>
              </View>
              <View style={styles.eventModalBody}>
                <View style={styles.eventMetaRow}>
                  <View style={[styles.eventTag, { backgroundColor: withAlpha(colors.teal, 0.12) }]}>
                    <Ionicons name="location" size={12} color={colors.teal} />
                    <Text style={[styles.eventTagText, { color: colors.teal }]}>{vocabularyLabel(activeEvent.city, t)}</Text>
                  </View>
                  <View style={[styles.eventTag, { backgroundColor: withAlpha(colors.gold, 0.14) }]}>
                    <Ionicons name="calendar" size={12} color={colors.gold} />
                    <Text style={[styles.eventTagText, { color: colors.gold }]}>{activeEvent.dateLabel}</Text>
                  </View>
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

// One tile shape for every face on this screen: a Mughal arch in a gold
// hairline frame, and a scrim that carries the caption without a grey bar over
// the face.
function PhotoTile({
  uri,
  name,
  title,
  caption,
  verified,
  accent,
  colors,
  onPress,
}: {
  uri: string;
  name: string;
  title: string;
  caption: string;
  verified?: boolean;
  accent: ModeAccent;
  colors: Palette;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress}>
      <View style={[styles.tileRim, glow(accent.primary, 0.14, 12, 4)]}>
        <View style={styles.tileInner}>
          <SmartImage uri={uri} name={name} style={styles.gridPhoto} size={30} />
          <LinearGradient
            colors={['transparent', 'rgba(20,11,16,0.15)', 'rgba(20,11,16,0.85)']}
            start={SCRIM_START}
            end={SCRIM_END}
            style={styles.tileScrim}
            pointerEvents="none"
          />
          {verified && (
            <View style={styles.gridHasPhoto} accessibilityLabel={t('profile.photoAdded')}>
              <Ionicons name="camera" size={10} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.gridCaption}>
            <Text style={styles.gridName} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.gridMeta} numberOfLines={1}>
              {caption}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ProfileRow({
  title,
  emptyLabel,
  profiles,
  captionFor,
  onPressProfile,
  colors,
  accent,
  rtl,
}: {
  title: string;
  emptyLabel: string;
  profiles: ExploreProfile[];
  captionFor: (profile: ExploreProfile) => string;
  onPressProfile: (profile: ExploreProfile) => void;
  colors: Palette;
  accent: ModeAccent;
  rtl: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <AccentHeading title={title} gradient={accent.duo} style={styles.sectionHeading} />
      {profiles.length === 0 ? (
        <Text style={[styles.sectionEmpty, rtl && styles.rtlText]}>{emptyLabel}</Text>
      ) : (
        <View style={styles.grid}>
          {profiles.map((profile, index) => (
            <Animated.View key={profile.id} entering={FadeInUp.delay(index * 50).duration(280)} style={styles.gridSlot}>
              <PhotoTile
                uri={profile.photos[0]}
                name={profile.name}
                title={profile.name}
                caption={captionFor(profile)}
                verified={profile.selfieVerified}
                accent={accent}
                colors={colors}
                onPress={() => onPressProfile(profile)}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    rowRtl: { flexDirection: 'row-reverse' },
    header: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      shadowColor: '#2A1720',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    filterChipActive: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
    filterLabel: { ...typography.label, color: colors.textSecondary },
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
    countPillText: { color: '#FFFFFF', fontSize: scaleFont(10), fontFamily: fonts.bodyBold },
    // Floating pill track, same as the Friends/Rishta toggle on Home.
    tabRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginHorizontal: spacing.md,
      padding: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#8E1B45',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    tabItem: { flex: 1 },
    tabPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    tabPillIdle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    tabLabel: { ...typography.label, color: colors.textSecondary, flexShrink: 1 },
    tabLabelActive: { ...typography.label, color: '#FFFFFF', fontFamily: fonts.bodyBold, flexShrink: 1 },
    content: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
    section: { marginTop: spacing.lg },
    sectionHeading: { marginBottom: spacing.sm },
    sectionEmpty: { ...typography.caption, color: colors.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, justifyContent: 'space-between' },
    gridSlot: { width: '48%' },
    // Oversized top radii are clamped to half the width: a full arched crest.
    tileRim: {
      padding: 3,
      borderWidth: 1.5,
      borderColor: withAlpha(colors.gold, 0.8),
      backgroundColor: colors.surface,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md + 3,
      borderBottomRightRadius: radius.md + 3,
    },
    tileInner: {
      aspectRatio: 3 / 4,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: colors.skeleton,
    },
    gridPhoto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    tileScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    // See DiscoverProfileCard.photoRing — a photo marker, not a verified tick.
    // Bottom corner: the arch clips the top ones.
    gridHasPhoto: {
      position: 'absolute',
      bottom: spacing.sm + 2,
      right: spacing.sm,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridCaption: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.xl },
    gridName: { ...typography.h3, fontSize: scaleFont(16), lineHeight: scaleFont(20), color: '#FFFFFF' },
    gridMeta: { fontSize: scaleFont(11), color: 'rgba(255,255,255,0.85)', marginTop: 1 },
    lockedCard: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: withAlpha(colors.gold, 0.7),
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    lockedImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    lockedBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
    lockedOrb: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
      borderWidth: 2,
      borderColor: colors.gold,
    },
    lockedCount: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
    lockedHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
    lockedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    lockedButtonText: { ...typography.label, color: '#FFFFFF', fontFamily: fonts.bodyBold },
    eventList: { marginTop: spacing.lg, gap: spacing.md },
    eventCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
    },
    eventImageWrap: { width: '100%', justifyContent: 'flex-end' },
    eventImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.skeleton },
    // Sits on the photo's scrim rather than under it, so the card leads with
    // the event's name instead of a slab of grey text.
    eventTitle: {
      ...typography.h3,
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: spacing.sm,
      color: '#FFFFFF',
    },
    eventBody: { padding: spacing.md, gap: spacing.sm },
    eventMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
    eventTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    eventTagText: { ...typography.label },
    eventActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    eventActionButton: { flex: 1 },
    eventCta: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingVertical: spacing.md },
    eventCtaText: { ...typography.bodyBold, color: '#FFFFFF' },
    eventShareButton: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
    eventModalCard: { width: '100%', backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, overflow: 'hidden' },
    eventModalImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.skeleton },
    eventModalBody: { padding: spacing.md, gap: spacing.sm },
    eventModalDescription: { ...typography.body, color: colors.textSecondary },
    eventModalCloseButton: { marginTop: spacing.xs },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
    // Mughal-arch frame, same empty-state shape as Home.
    emptyOrb: {
      width: 88,
      height: 104,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.sm,
    },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.sm,
      shadowColor: '#2A1720',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    historyAvatarRing: { width: 50, height: 50, borderRadius: 25, padding: 2 },
    historyAvatar: { width: '100%', height: '100%', borderRadius: 23, backgroundColor: colors.skeleton },
    historyTextWrap: { flex: 1 },
    historyName: { ...typography.h3, color: colors.textPrimary },
    historyMeta: { ...typography.caption, color: colors.textSecondary },
    clearButton: { marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.gold },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
