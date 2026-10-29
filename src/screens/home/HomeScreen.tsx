import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn as ReanimatedFadeIn,
  FadeInDown,
  FadeOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AuroraBackground } from '../../components/common/AuroraBackground';
import { PhotoPreview } from '../../components/common/PhotoPreview';
import { EmptyOrb } from '../../components/common/EmptyOrb';
import { DiscoverProfileCard } from '../../components/discover/DiscoverProfileCard';
import { TAB_BAR_BASE_HEIGHT } from '../../store/TabBarVisibilityContext';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
import { HomeTopBar } from '../../components/discover/HomeTopBar';
import { HomeStoriesRow } from '../../components/discover/HomeStoriesRow';
import { MatchScoreCard } from '../../components/discover/MatchScoreCard';
import { MatchWhySheet } from '../../components/discover/MatchWhySheet';
import { SwipeActionBar } from '../../components/discover/SwipeActionBar';
import { BrowseFiltersSheet, BrowseSortSheet } from '../../components/discover/BrowseSheets';
import {
  DEFAULT_BROWSE_FILTERS,
  applyBrowseFilters,
  compareBySort,
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
import { useActivityHistory } from '../../store/ActivityHistoryContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { datingCompatibility, rishtaCompatibility, sharedTraits } from '../../utils/compatibility';
import { radius, spacing, typography } from '../../theme';
import { APP_MODE, glow, modeAccent } from '../../theme/glow';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { FREE_MATCH_SCORE, FREE_REWIND } from '../../config/features';

// Clearance under the scroll content so the floating action bar never covers the
// last row of a profile.
const ACTION_BAR_CLEARANCE = 92;
// How long "Liked · Undo" stays up after a like.
const UNDO_LIKE_MS = 5000;

// How few cards may be left before the next page is fetched. Far enough ahead
// that a fast swiper never reaches the end of the deck while it loads.
const DECK_LOW_WATER = 5;

export function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { isFavorite, isLiked, toggleLike, unlike, toggleFavorite } = useFavorites();
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
  const { addNotification, dropLikeRows, unreadCount } = useNotifications();
  const { recordView } = useViewHistory();
  const { recordPass, recordCompliment, unhideLiked } = useActivityHistory();
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);
  const [cursor, setCursor] = useState(0);
  // The like just sent, offered back for a few seconds: a mis-tap on Like moves
  // straight on to the next card, so this is the moment to catch it.
  const [undoLike, setUndoLike] = useState<{ id: string; name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);
  const offerUndoLike = (id: string, name: string) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoLike({ id, name });
    undoTimer.current = setTimeout(() => setUndoLike(null), UNDO_LIKE_MS);
  };
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const insets = useSafeAreaInsets();

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.id)),
    [blockedProfiles]
  );

  // The strip shows only people this member has matched with (both liked).
  // The server already returns no one else (story_feed / are_connected in
  // supabase/46_stories.sql); this keeps the strip to that rule even while a
  // just-ended match or a fresh block is still in the cached feed.
  const matchedStoryGroups = useMemo(() => {
    const matchedIds = new Set(
      matches
        .map((m) => m.sourceProfileId)
        .filter((id): id is string => typeof id === 'string' && !blockedProfileIds.has(id))
    );
    return storyGroups.filter((g) => matchedIds.has(g.userId));
  }, [storyGroups, matches, blockedProfileIds]);

  // One deck for everyone: casual members show as Friends cards, serious and
  // matrimonial members as Rishta cards. The Intent filter is how a member
  // narrows it to one kind. Anyone casual whose thread moved to Rishta stays off
  // the deck for good.
  // Someone already matched is a conversation, not a card to swipe. Cards the
  // member has already had on screen stay, though: dropping one from behind
  // the cursor (a like that just matched) would shift the deck and skip the
  // next person.
  const shownIds = useRef(new Set<string>());
  const matchedIds = useMemo(
    () => new Set(matches.map((m) => m.sourceProfileId).filter((id): id is string => Boolean(id))),
    [matches]
  );
  const deck = useMemo(() => {
    const visible = (p: BrowseProfile) =>
      !blockedProfileIds.has(p.id) && (!matchedIds.has(p.id) || shownIds.current.has(p.id));
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
  }, [datingProfiles, rishtaProfiles, user?.gender, blockedProfileIds, rishtaProfileIds, matchedIds]);

  // A non-default sort reorders only the cards still ahead: the ones already
  // swiped keep their places, so a page arriving mid-deck (loadMore below) can
  // slot its profiles in among the unseen ones without moving the card on
  // screen or skipping anyone. A change of filters or sort starts over (cursor
  // goes back to 0 further down), so nothing is pinned then.
  const cursorRef = useRef(0);
  cursorRef.current = cursor;
  const orderRef = useRef<{ filters: BrowseFilters; ids: string[] }>({ filters, ids: [] });
  const visibleProfiles = useMemo(() => {
    const list = applyBrowseFilters(deck, filters);
    // Scored the way the match card scores the card on screen.
    const scores = new Map<string, number>();
    const scoreOf = (p: (typeof list)[number]) => {
      let score = scores.get(p.id);
      if (score === undefined) {
        score = !user
          ? 0
          : p.intent === 'casual'
            ? datingCompatibility(user, p as DiscoverProfile)
            : rishtaCompatibility(user, p as RishtaListingProfile);
        scores.set(p.id, score);
      }
      return score;
    };
    const compare = compareBySort(filters.sort, scoreOf);
    let ordered = list;
    if (compare) {
      const sameControls = orderRef.current.filters === filters;
      const pinnedIds = sameControls ? orderRef.current.ids.slice(0, cursorRef.current) : [];
      const byId = new Map(list.map((p) => [p.id, p]));
      const pinned = pinnedIds.map((id) => byId.get(id)).filter((p): p is (typeof list)[number] => Boolean(p));
      const pinnedSet = new Set(pinned.map((p) => p.id));
      ordered = [...pinned, ...list.filter((p) => !pinnedSet.has(p.id)).sort(compare)];
    }
    orderRef.current = { filters, ids: ordered.map((p) => p.id) };
    return ordered;
  }, [deck, filters, user]);

  const safeCursor = Math.min(cursor, visibleProfiles.length);
  const currentProfile = visibleProfiles[safeCursor];
  if (currentProfile) shownIds.current.add(currentProfile.id);

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

  // The same comparison the match score is built from (utils/compatibility),
  // so the reasons listed always add up to the number above them.
  const similarities = useMemo(() => {
    if (!user || !currentProfile) return [];
    return sharedTraits(user, currentProfile, mode).map((trait) => {
      if (trait.text) return trait.text;
      const params = { ...trait.params };
      // Readiness arrives as its own dictionary key, translated in place.
      if (typeof params.readiness === 'string') params.readiness = t(params.readiness);
      return t(trait.key, params);
    });
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
    if (!user?.isExplorePlus && !FREE_REWIND) {
      await promptUpgrade(t('discover.rewindLockedTitle'), t('discover.rewindLockedBody'));
      return;
    }
    setCursor((c) => Math.max(c - 1, 0));
  };

  const summaryOf = (p: NonNullable<typeof currentProfile>) => ({
    id: p.id,
    kind: mode,
    name: p.name,
    age: p.age,
    city: p.city,
    photo: p.photos[0] ?? '',
  });

  const onPass = () => {
    if (!currentProfile) return;
    recordPass(summaryOf(currentProfile));
    advance();
  };

  const onOpenMatchScore = async () => {
    if (!currentProfile) return;
    if (!user?.isExplorePlus && !FREE_MATCH_SCORE) {
      await promptUpgrade(
        t('discover.matchScoreLockedTitle'),
        t('discover.matchScoreLockedBody', { name: currentProfile.name })
      );
      return;
    }
    setWhyOpen(true);
  };

  const onLike = async () => {
    if (!currentProfile) return;
    const profile = currentProfile;
    const wasLiked = isLiked(profile.id);
    if (!wasLiked) {
      const allowed = recordLike();
      if (!allowed) {
        const wantsUpgrade = await promptUpgrade(t('discover.limitReachedTitle'), t('discover.limitReachedBody'));
        if (wantsUpgrade) return;
        advance();
        return;
      }
    }
    let outcome: Awaited<ReturnType<typeof toggleLike>> = null;
    try {
      outcome = await toggleLike({
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
    if (!wasLiked) unhideLiked(profile.id);
    if (!wasLiked) {
      // Only on the call that formed the pair. `isNew` comes from the RPC
      // itself, so this cannot fire on a one-sided like, and re-liking someone
      // already matched does not celebrate again.
      if (outcome?.isNew) {
        setCelebration({ name: profile.name, photo: profile.photos[0] });
        addNotification('match', t('matches.itsAMatch'), t('matches.matchedBody', { name: profile.name }), { id: profile.id, kind: mode });
      }
      if (mode !== 'dating') {
        addNotification('like', t('profileDetail.interestSentTitle'), t('profileDetail.interestSentBody', { name: profile.name }), { id: profile.id, kind: mode });
        await notify({ title: t('profileDetail.interestSentTitle'), message: t('profileDetail.interestSentBody', { name: profile.name }) });
      }
      // A match is a conversation now, not something to take back here.
      if (outcome && !outcome.isNew) offerUndoLike(profile.id, profile.name);
    }
    advance();
  };

  // Takes the like back everywhere (their "who liked you", their notification,
  // a trial it used) and brings the card back up.
  const onUndoLike = async () => {
    const target = undoLike;
    if (!target) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoLike(null);
    const ok = await unlike(target.id);
    if (!ok) {
      await notify({ title: t('discover.undoLikeFailed') });
      return;
    }
    dropLikeRows(target.id);
    const index = visibleProfiles.findIndex((p) => p.id === target.id);
    if (index >= 0) setCursor(index);
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
    recordCompliment(summaryOf(currentProfile), text);
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
        sortActive={filters.sort !== DEFAULT_BROWSE_FILTERS.sort}
        sortOpen={sortVisible}
        onOpenSort={() => setSortVisible(true)}
        notificationCount={unreadCount}
        onNotifications={() => router.push('/notifications')}
      />

      <HomeStoriesRow
        myPhoto={user.photos[0]}
        hasMyStory={Boolean(myStories)}
        posting={postingStory}
        onPressMine={() => router.push({ pathname: '/story/[userId]', params: { userId: user.id } })}
        onAddStory={addStory}
        groups={matchedStoryGroups}
        onPressGroup={(id) => router.push({ pathname: '/story/[userId]', params: { userId: id } })}
        connections={[]}
        onPressConnection={() => {}}
        suggestions={[]}
        onPressSuggestion={() => {}}
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
            {/* No swipe: Pass and Like are the buttons in the bar below, so a tap on
                the photo always reaches the photo. */}
            <DiscoverProfileCard
              profile={currentProfile}
              liked={isLiked(currentProfile.id)}
              onPressPhoto={(uri) => setPreviewUri((cur) => cur ?? uri)}
            />

            <MatchScoreCard
              name={currentProfile.name}
              score={compatibilityScore}
              bureauVerified={Boolean(currentProfile.bureauVerified)}
              locked={!user.isExplorePlus && !FREE_MATCH_SCORE}
              onPress={onOpenMatchScore}
            />

            <View style={styles.content}>
              <SimilaritiesSection name={currentProfile.name} items={similarities} />

              <AboutMeSection profile={currentProfile} />
              <ReadinessSection profile={currentProfile} />

              {/* A member who blurs their photos keeps the second one hidden too,
                  until they match or like the viewer, same as the card above. */}
              {!currentProfile.photosBlurred && (
                <MidProfilePhoto photos={currentProfile.photos} onPress={(uri) => setPreviewUri((cur) => cur ?? uri)} />
              )}
              <IntroMediaSection profile={currentProfile} />

              <FaithSection profile={currentProfile} />
              <FuturePlansSection profile={currentProfile} />
              <InterestsSection profile={currentProfile} />
              <PersonalitySection profile={currentProfile} />
              <EducationCareerSection profile={currentProfile} />
              <LanguagesBackgroundSection profile={currentProfile} />
              <BioSection profile={currentProfile} />

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
            liked={isLiked(currentProfile.id)}
            locked={!user.isExplorePlus && !FREE_REWIND}
            onUndo={onUndo}
            onPass={onPass}
            onLike={onLike}
            bottomInset={actionBarBottom}
          />
          {undoLike && (
            <Animated.View
              entering={FadeInDown.duration(180)}
              exiting={FadeOutDown.duration(160)}
              style={[styles.undoWrap, { bottom: actionBarBottom + ACTION_BAR_CLEARANCE - spacing.sm }]}
              pointerEvents="box-none"
            >
              <View style={[styles.undoBar, rtl && styles.rowRtl]}>
                <Ionicons name="heart" size={16} color={accent.primary} />
                <Text style={[styles.undoText, rtl && styles.rtlText]} numberOfLines={1}>
                  {t('discover.likedUndoText', { name: undoLike.name })}
                </Text>
                <Pressable onPress={onUndoLike} hitSlop={8} style={styles.undoAction} accessibilityRole="button">
                  <Text style={[styles.undoActionText, { color: accent.primary }]}>{t('discover.likedUndo')}</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
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

      <BrowseSortSheet
        visible={sortVisible}
        sort={filters.sort}
        onChange={(sort) => setFilters((f) => ({ ...f, sort }))}
        onClose={() => setSortVisible(false)}
      />

      <PhotoPreview uri={previewUri} onClose={() => setPreviewUri(null)} />

      {currentProfile && (
        <MatchWhySheet
          visible={whyOpen}
          name={currentProfile.name}
          score={compatibilityScore}
          reasons={similarities}
          onClose={() => setWhyOpen(false)}
          onViewProfile={() => {
            setWhyOpen(false);
            router.push({ pathname: '/profile-detail', params: { kind: mode, id: currentProfile.id } });
          }}
          onEditProfile={() => {
            setWhyOpen(false);
            router.push('/edit-profile');
          }}
        />
      )}

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
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    rowRtl: { flexDirection: 'row-reverse' },
    undoWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
    undoBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingLeft: spacing.md,
      paddingRight: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    undoText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600', flex: 1 },
    undoAction: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    undoActionText: { ...typography.label, fontWeight: '800' },
  });
