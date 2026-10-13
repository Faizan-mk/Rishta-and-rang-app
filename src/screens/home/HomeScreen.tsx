import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn as ReanimatedFadeIn,
} from 'react-native-reanimated';
import { AuroraBackground } from '../../components/common/AuroraBackground';
import { EmptyOrb } from '../../components/common/EmptyOrb';
import { DiscoverProfileCard } from '../../components/discover/DiscoverProfileCard';
import { TAB_BAR_BASE_HEIGHT } from '../../store/TabBarVisibilityContext';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
import { HomeTopBar } from '../../components/discover/HomeTopBar';
import { HomeStoriesRow, type StoryConnection, type StorySuggestion } from '../../components/discover/HomeStoriesRow';
import { MatchScoreCard } from '../../components/discover/MatchScoreCard';
import { SwipeableCard } from '../../components/discover/SwipeableCard';
import { SwipeActionBar } from '../../components/discover/SwipeActionBar';
import { BrowseFiltersSheet } from '../../components/discover/BrowseSheets';
import {
  DEFAULT_BROWSE_FILTERS,
  countActiveFilters,
  type BrowseFilters,
} from '../../components/discover/browseOptions';
import {
  AboutMeSection,
  BioSection,
  ReadinessSection,
  FaithSection,
  FuturePlansSection,
  InterestsSection,
  PersonalitySection,
  EducationCareerSection,
  LanguagesBackgroundSection,
  SimilaritiesSection,
  VerificationSection,
  MidProfilePhoto,
  IntroMediaSection,
} from '../../components/discover/ProfileDetailSections';
import { ProfileActionsFooter } from '../../components/discover/ProfileActionsFooter';
import { ProfileUtilityBar } from '../../components/discover/ProfileUtilityBar';
import { ReportDialog, type ReportSubmission } from '../../components/common/ReportDialog';
import { reportsService } from '../../services/reportsService';
import { profileNotesService } from '../../services/profileNotesService';
import { prefetchImages } from '../../services/imageCache';
import type { BrowseProfile, DiscoverProfile, RishtaListingProfile } from '../../types/content';
import type { ProfileMode } from '../../types/user';
import { useDiscovery } from '../../store/DiscoveryContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useFavorites } from '../../store/FavoritesContext';
import { useDialog } from '../../store/DialogContext';
import { useLikeLimit } from '../../store/LikeLimitContext';
import { useMatches } from '../../store/MatchesContext';
import { useStories } from '../../store/StoriesContext';
import { useAddStory } from '../../hooks/useAddStory';
import { useNotifications } from '../../store/NotificationContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { datingCompatibility, rishtaCompatibility } from '../../utils/compatibility';
import { isActiveToday } from '../../utils/time';
import { radius, spacing, typography } from '../../theme';
import { APP_MODE, glow, modeAccent } from '../../theme/glow';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';

// Clearance under the scroll content so the floating action bar never covers the
// last row of a profile.
const ACTION_BAR_CLEARANCE = 92;

// How few cards may be left before the next page is fetched. Far enough ahead
// that a fast swiper never reaches the end of the deck while it loads.
const DECK_LOW_WATER = 5;

// How many deck profiles fill out the end of the story strip.
const STORY_SUGGESTION_COUNT = 12;

export function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { confirm, notify } = useDialog();
  const { recordLike, applyServerCount } = useLikeLimit();
  const { datingProfiles, rishtaProfiles, loading, loadMore, reload } = useDiscovery();
  const { matches, rishtaProfileIds, blockedProfiles, blockProfile } = useMatches();
  const { mine: myStories, others: storyGroups, refresh: refreshStories } = useStories();
  // Coming back to Home (from a chat, or from watching stories) picks up new
  // stories, fresh seen-rings and seen-by counts.
  useFocusEffect(
    useCallback(() => {
      refreshStories();
    }, [refreshStories])
  );
  const { addStory, posting: postingStory } = useAddStory();
  const { addNotification, unreadCount } = useNotifications();
  const { recordView } = useViewHistory();
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);
  const [cursor, setCursor] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const insets = useSafeAreaInsets();

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.id)),
    [blockedProfiles]
  );

  // Connections without a story up, most recent chat first, for the end of
  // the story strip. Anyone with a story already has a circle further left.
  const storyConnections = useMemo<StoryConnection[]>(() => {
    const withStory = new Set(storyGroups.map((g) => g.userId));
    return matches
      .filter((m) => !m.sourceProfileId || (!blockedProfileIds.has(m.sourceProfileId) && !withStory.has(m.sourceProfileId)))
      .map((m) => ({ matchId: m.id, name: m.name, photo: m.photo }));
  }, [matches, storyGroups, blockedProfileIds]);

  // One deck for everyone: casual members show as Friends cards, serious and
  // matrimonial members as Rishta cards. The Intent filter is how a member
  // narrows it to one kind. Anyone casual whose thread moved to Rishta stays off
  // the deck for good.
  const deck = useMemo(() => {
    const visible = (p: BrowseProfile) => !blockedProfileIds.has(p.id);
    const dating = oppositeGenderProfiles(datingProfiles, user?.gender).filter(
      (p) => visible(p) && !rishtaProfileIds.has(p.id) && p.intent === 'casual'
    );
    const rishta = oppositeGenderProfiles(rishtaProfiles, user?.gender).filter(
      (p) => visible(p) && (p.intent === 'serious' || p.intent === 'matrimonial')
    );
    // Both lists read the same rows in the same order, so walking the dating
    // order keeps the server's ranking across the two kinds.
    const byId = new Map<string, DiscoverProfile | RishtaListingProfile>();
    rishta.forEach((p) => byId.set(p.id, p));
    dating.forEach((p) => byId.set(p.id, p));
    const order = [...datingProfiles.map((p) => p.id), ...rishtaProfiles.map((p) => p.id)];
    const seen = new Set<string>();
    const list: (DiscoverProfile | RishtaListingProfile)[] = [];
    order.forEach((id) => {
      const p = byId.get(id);
      if (!p || seen.has(id)) return;
      seen.add(id);
      list.push(p);
    });
    return list;
  }, [datingProfiles, rishtaProfiles, user?.gender, blockedProfileIds, rishtaProfileIds]);

  // The browse bar's filters are applied on top of the deck.
  // Deck profiles for the end of the story strip, after the member's own
  // connections, so a member with few matches still sees a full strip. Anyone
  // already in the strip, or already matched, is left out.
  const storySuggestions = useMemo<StorySuggestion[]>(() => {
    const inStrip = new Set<string>([
      ...storyGroups.map((g) => g.userId),
      ...matches.map((m) => m.sourceProfileId).filter((id): id is string => Boolean(id)),
    ]);
    return deck
      .filter((p) => !inStrip.has(p.id) && p.photos[0])
      .slice(0, STORY_SUGGESTION_COUNT)
      .map((p) => ({ id: p.id, name: p.name, photo: p.photos[0], kind: p.intent === 'casual' ? 'dating' : 'rishta' }));
  }, [deck, storyGroups, matches]);

  const visibleProfiles = useMemo(() => {
    let list = deck.filter((p) => p.age >= filters.ageMin && p.age <= filters.ageMax);
    if (filters.city) {
      const city = filters.city.toLowerCase();
      list = list.filter((p) => p.city?.toLowerCase() === city);
    }
    if (filters.intent) list = list.filter((p) => p.intent === filters.intent);
    if (filters.sect) {
      const sect = filters.sect.toLowerCase();
      list = list.filter((p) => p.sect?.toLowerCase() === sect);
    }
    if (filters.readiness) list = list.filter((p) => p.readiness === filters.readiness);
    if (filters.verifiedOnly) list = list.filter((p) => p.selfieVerified || p.bureauVerified);
    if (filters.activeToday) list = list.filter((p) => isActiveToday(p.lastActiveAt));
    return list;
  }, [deck, filters]);

  const safeCursor = Math.min(cursor, visibleProfiles.length);
  const currentProfile = visibleProfiles[safeCursor];

  // Which kind of card is on screen: casual members are Friends, everyone else
  // is Rishta. It decides what a like does and which details count, not the
  // colours: the whole screen wears the app's one colour.
  const mode: ProfileMode = currentProfile?.intent === 'casual' ? 'dating' : 'rishta';
  const accent = modeAccent(colors, APP_MODE);

  // The deck arrives a page at a time now, so the next page is fetched while
  // there are still cards left to swipe â€” not when the member hits the end and
  // has to wait. The filters run client-side over what has been fetched, so a
  // narrow filter is exactly the case that needs more pages.
  useEffect(() => {
    if (visibleProfiles.length - safeCursor <= DECK_LOW_WATER) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCursor, visibleProfiles.length]);
  const canUndo = safeCursor > 0;
  const filtersActive = countActiveFilters(filters);

  // Warm the photo caches up front so a profile change never sits on
  // a blank card while the new profile's image downloads from the network.
  useEffect(() => {
    const warm = (p: BrowseProfile | undefined) => {
      if (!p) return;
      p.photos.forEach((uri) => {
        if (uri.startsWith('http')) Image.prefetch(uri).catch(() => {});
      });
      // `Image.prefetch` only fills the in-memory cache, which is gone the next
      // time the app starts. This one lands on disk, so a deck reopened tomorrow
      // costs nothing (see services/imageCache.ts).
      prefetchImages(p.photos);
    };
    warm(currentProfile);
    // The card after this one, so a swipe never lands on a blank photo.
    warm(visibleProfiles[safeCursor + 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.id]);

  // A re-filtered deck is a different deck, so start it from the top
  // instead of landing mid-way through it.
  useEffect(() => {
    setCursor(0);
  }, [filters]);

  useEffect(() => {
    if (!currentProfile) return;
    recordView({
      id: currentProfile.id,
      kind: mode,
      name: currentProfile.name,
      age: currentProfile.age,
      city: currentProfile.city,
      photo: currentProfile.photos[0],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.id, mode]);

  const compatibilityScore =
    user && currentProfile
      ? mode === 'dating'
        ? datingCompatibility(user, currentProfile as DiscoverProfile)
        : rishtaCompatibility(user, currentProfile as RishtaListingProfile)
      : 0;

  const similarities = useMemo(() => {
    if (!user || !currentProfile) return [];
    const found: string[] = [];
    if (user.city && currentProfile.city && user.city.toLowerCase() === currentProfile.city.toLowerCase()) {
      found.push(t('discover.similarCity', { city: currentProfile.city }));
    }
    if (mode === 'dating') {
      const userTags = new Set(user.dating.vibeTags.map((tag) => tag.toLowerCase()));
      (currentProfile.vibeTags ?? []).forEach((tag) => {
        if (userTags.has(tag.toLowerCase())) found.push(t('discover.similarTag', { tag }));
      });
    } else {
      if (user.rishta.religion && currentProfile.religion && user.rishta.religion.toLowerCase() === currentProfile.religion.toLowerCase()) {
        found.push(currentProfile.religion);
      }
      if (user.rishta.sect && currentProfile.sect && user.rishta.sect.toLowerCase() === currentProfile.sect.toLowerCase()) {
        found.push(currentProfile.sect);
      }
    }
    return found;
  }, [user, currentProfile, mode, t]);

  const advance = () => setCursor((c) => Math.min(c + 1, visibleProfiles.length));

  // Every locked control funnels through the same upsell prompt.
  const promptUpgrade = async (title: string, message: string) => {
    const wantsUpgrade = await confirm({
      title,
      message,
      confirmLabel: t('explorePlus.upgrade'),
      cancelLabel: t('common.cancel'),
    });
    if (wantsUpgrade) router.push('/explore-plus');
    return wantsUpgrade;
  };

  const onUndo = async () => {
    if (!canUndo) return;
    if (!user?.isExplorePlus) {
      await promptUpgrade(t('discover.rewindLockedTitle'), t('discover.rewindLockedBody'));
      return;
    }
    setCursor((c) => Math.max(c - 1, 0));
  };

  const onPass = () => {
    if (!currentProfile) return;
    advance();
  };

  const onOpenMatchScore = async () => {
    if (!currentProfile) return;
    if (!user?.isExplorePlus) {
      await promptUpgrade(
        t('discover.matchScoreLockedTitle'),
        t('discover.matchScoreLockedBody', { name: currentProfile.name })
      );
      return;
    }
    router.push({ pathname: '/profile-detail', params: { kind: mode, id: currentProfile.id } });
  };

  const onLike = async () => {
    if (!currentProfile) return;
    const profile = currentProfile;
    const wasLiked = isFavorite(profile.id);
    if (!wasLiked) {
      const allowed = recordLike();
      if (!allowed) {
        const wantsUpgrade = await promptUpgrade(t('discover.limitReachedTitle'), t('discover.limitReachedBody'));
        if (wantsUpgrade) return;
        advance();
        return;
      }
    }
    let outcome: Awaited<ReturnType<typeof toggleFavorite>> = null;
    try {
      outcome = await toggleFavorite({
        id: profile.id,
        kind: mode,
        name: profile.name,
        age: profile.age,
        city: profile.city,
        photo: profile.photos[0],
      });
    } catch {
      // The cap is the server's to enforce now, so it can refuse even when the
      // local counter thought there was room â€” a second device, or a count this
      // session never saw.
      const wantsUpgrade = await promptUpgrade(t('discover.limitReachedTitle'), t('discover.limitReachedBody'));
      if (!wantsUpgrade) advance();
      return;
    }
    // What the server actually counted, which is the number the "likes left"
    // line should show.
    if (outcome) applyServerCount(outcome.likesLeft);
    if (!wasLiked) {
      // Only on the call that formed the pair. `isNew` comes from the RPC
      // itself, so this cannot fire on a one-sided like, and re-liking someone
      // already matched does not celebrate again.
      if (outcome?.isNew) {
        setCelebration({ name: profile.name, photo: profile.photos[0] });
        addNotification('match', t('matches.itsAMatch'), t('matches.matchedBody', { name: profile.name }));
      }
      if (mode !== 'dating') {
        addNotification('like', t('profileDetail.interestSentTitle'), t('profileDetail.interestSentBody', { name: profile.name }));
        await notify({ title: t('profileDetail.interestSentTitle'), message: t('profileDetail.interestSentBody', { name: profile.name }) });
      }
    }
    advance();
  };

  const onToggleFavourite = () => {
    if (!currentProfile) return;
    const profile = currentProfile;
    toggleFavorite({ id: profile.id, kind: mode, name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] });
  };

  const onShareProfile = async () => {
    if (!currentProfile) return;
    try {
      await Share.share({ message: t('discover.shareMessage', { name: currentProfile.name }) });
    } catch {
      // User dismissed the share sheet â€” nothing to do.
    }
  };

  const onBlockProfile = async () => {
    if (!currentProfile) return;
    const profile = currentProfile;
    const confirmed = await confirm({
      title: t('chat.blockConfirmTitle', { name: profile.name }),
      message: t('chat.blockConfirmBody'),
      confirmLabel: t('chat.block'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    // Blocking is per person, not per thread â€” there may well be no thread with
    // someone you are blocking straight off the deck.
    blockProfile({ id: profile.id, name: profile.name, photo: profile.photos[0], mode });
  };

  const onSubmitReport = async (submission: ReportSubmission) => {
    setReportVisible(false);
    if (!currentProfile || !user) return;
    try {
      await reportsService.submitReport(user.id, {
        targetId: currentProfile.id,
        reason: submission.reason,
        details: submission.details,
        context: 'discover',
      });
    } catch {
      await notify({ title: t('report.failedTitle'), message: t('report.failedBody') });
      return;
    }
    await notify({ title: t('chat.reportSentTitle'), message: t('chat.reportSentBody') });
  };

  const onSendCompliment = async (text: string) => {
    if (!currentProfile) return;
    try {
      await profileNotesService.sendNote(currentProfile.id, text);
    } catch {
      await notify({ title: t('report.failedTitle'), message: t('report.failedBody') });
      return;
    }
    await notify({ title: t('discover.complimentSentTitle'), message: t('discover.complimentSentBody', { name: currentProfile.name }) });
  };

  if (!user) return null;

  const actionBarBottom = TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.sm;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Drifting colour behind everything, repainted per mode. Decorative only. */}
      <AuroraBackground colors={colors} mode={APP_MODE} />

      <HomeTopBar
        activeFilterCount={filtersActive}
        onOpenFilters={() => setFiltersVisible(true)}
        filtersOpen={filtersVisible}
        notificationCount={unreadCount}
        onNotifications={() => router.push('/notifications')}
      />

      <HomeStoriesRow
        myPhoto={user.photos[0]}
        hasMyStory={Boolean(myStories)}
        posting={postingStory}
        onPressMine={() => router.push({ pathname: '/story/[userId]', params: { userId: user.id } })}
        onAddStory={addStory}
        groups={storyGroups}
        onPressGroup={(id) => router.push({ pathname: '/story/[userId]', params: { userId: id } })}
        connections={storyConnections}
        onPressConnection={(matchId) => router.push(`/chat/${matchId}`)}
        suggestions={storySuggestions}
        onPressSuggestion={(p) => router.push({ pathname: '/profile-detail', params: { kind: p.kind, id: p.id } })}
      />

      {currentProfile ? (
        <Animated.View key={`${mode}-${currentProfile.id}`} entering={ReanimatedFadeIn.duration(120)} style={styles.flex}>
          {/* The action bar floats over this scroll view, so the content reserves
              its height (plus the tab bar) at the bottom instead of ending flush. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: actionBarBottom + ACTION_BAR_CLEARANCE }}
            refreshControl={
              /* The deck is cached per sign-in, so a pull is how a member picks up
                 profiles edited or added since the app opened. */
              <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.teal} colors={[colors.teal]} />
            }
          >
            <SwipeableCard profileId={currentProfile.id} onSwipeRight={onLike} onSwipeLeft={onPass}>
              <DiscoverProfileCard
                profile={currentProfile}
                liked={isFavorite(currentProfile.id)}
                onPressPhoto={setPreviewUri}
              />
            </SwipeableCard>

            <MatchScoreCard
              name={currentProfile.name}
              score={compatibilityScore}
              bureauVerified={Boolean(currentProfile.bureauVerified)}
              onPress={onOpenMatchScore}
            />

            <View style={styles.content}>
              <SimilaritiesSection name={currentProfile.name} items={similarities} />

              <AboutMeSection profile={currentProfile} />
              <ReadinessSection profile={currentProfile} />

              <MidProfilePhoto photos={currentProfile.photos} onPress={setPreviewUri} />
              <IntroMediaSection profile={currentProfile} />

              <FaithSection profile={currentProfile} />
              <FuturePlansSection profile={currentProfile} />
              <InterestsSection profile={currentProfile} />
              <PersonalitySection profile={currentProfile} />
              <EducationCareerSection profile={currentProfile} />
              <LanguagesBackgroundSection profile={currentProfile} />
              <BioSection profile={currentProfile} />
              <VerificationSection profile={currentProfile} />

              <ProfileActionsFooter name={currentProfile.name} onSendCompliment={onSendCompliment} />

              <ProfileUtilityBar
                liked={isFavorite(currentProfile.id)}
                onShare={onShareProfile}
                onToggleFavourite={onToggleFavourite}
                onBlock={onBlockProfile}
                onReport={() => setReportVisible(true)}
              />
            </View>
          </ScrollView>

          <SwipeActionBar
            canUndo={canUndo}
            liked={isFavorite(currentProfile.id)}
            locked={!user.isExplorePlus}
            onUndo={onUndo}
            onPass={onPass}
            onLike={onLike}
            bottomInset={actionBarBottom}
          />
        </Animated.View>
      ) : (
        <Animated.View entering={ReanimatedFadeIn.duration(240)} style={styles.emptyState}>
          <EmptyOrb ramp={accent.ramp} icon="sparkles" />
          <Text style={[styles.emptyText, rtl && styles.rtlText]}>
            {filtersActive > 0 ? t('discover.filtersEmpty') : t('discover.outOfProfiles')}
          </Text>
          {filtersActive > 0 && (
            <Pressable onPress={() => setFilters(DEFAULT_BROWSE_FILTERS)}>
              <LinearGradient
                colors={accent.duo}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.emptyResetButton, glow(accent.primary, 0.5, 14, 6)]}
              >
                <Text style={styles.emptyResetLabel}>{t('discover.filtersReset')}</Text>
              </LinearGradient>
            </Pressable>
          )}
        </Animated.View>
      )}

      <BrowseFiltersSheet
        visible={filtersVisible}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFiltersVisible(false)}
      />

      <Modal visible={Boolean(previewUri)} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewUri(null)}>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />}
        </Pressable>
      </Modal>

      <MatchCelebration
        visible={Boolean(celebration)}
        name={celebration?.name ?? ''}
        photo={celebration?.photo ?? ''}
        onClose={() => setCelebration(null)}
      />

      <ReportDialog
        visible={reportVisible}
        name={currentProfile?.name ?? ''}
        onCancel={() => setReportVisible(false)}
        onSubmit={onSubmitReport}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    emptyResetButton: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    emptyResetLabel: { ...typography.label, color: '#FFFFFF', fontSize: scaleFont(13) },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: '100%', height: '80%' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
