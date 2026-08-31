import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn as ReanimatedFadeIn,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import { AuroraBackground } from '../../components/common/AuroraBackground';
import { DiscoverProfileCard } from '../../components/discover/DiscoverProfileCard';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
import { HomeTopBar } from '../../components/discover/HomeTopBar';
import { ModeToggle } from '../../components/profile/ModeToggle';
import { MatchScoreCard } from '../../components/discover/MatchScoreCard';
import { SwipeableCard } from '../../components/discover/SwipeableCard';
import { SwipeActionBar } from '../../components/discover/SwipeActionBar';
import { BrowseFiltersSheet, BrowseSortSheet } from '../../components/discover/BrowseSheets';
import { BoostSheet } from '../../components/discover/BoostSheet';
import {
  DEFAULT_BROWSE_FILTERS,
  DEFAULT_BROWSE_SORT,
  countActiveFilters,
  type BrowseFilters,
  type BrowseSortKey,
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
import { ReportDialog } from '../../components/common/ReportDialog';
import type { BrowseProfile, DiscoverProfile, RishtaListingProfile } from '../../types/content';
import type { ProfileMode, UserProfile } from '../../types/user';
import { useDiscovery } from '../../store/DiscoveryContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useFavorites } from '../../store/FavoritesContext';
import { useDialog } from '../../store/DialogContext';
import { useLikeLimit } from '../../store/LikeLimitContext';
import { useBoost } from '../../store/BoostContext';
import { useMatches } from '../../store/MatchesContext';
import { useNotifications } from '../../store/NotificationContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { datingCompatibility, rishtaCompatibility } from '../../utils/compatibility';
import { isActiveToday } from '../../utils/time';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent } from '../../theme/glow';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';

// Clearance under the scroll content so the floating action bar never covers the
// last row of a profile.
const ACTION_BAR_CLEARANCE = 92;

interface SortContext {
  user: UserProfile | null;
  mode: ProfileMode;
  // Profiles the member already has a chat thread with.
  chattingWith: Set<string>;
}

function timestamp(iso?: string): number {
  return iso ? new Date(iso).getTime() : 0;
}

function sortProfiles<T extends BrowseProfile>(profiles: T[], sort: BrowseSortKey, ctx: SortContext): T[] {
  if (sort === 'recommended') return profiles;
  const { user, mode, chattingWith } = ctx;
  const sorted = [...profiles];

  switch (sort) {
    case 'bestMatch': {
      if (!user) return profiles;
      const score = (p: T) =>
        mode === 'dating'
          ? datingCompatibility(user, p as unknown as DiscoverProfile)
          : rishtaCompatibility(user, p as unknown as RishtaListingProfile);
      return sorted.sort((a, b) => score(b) - score(a));
    }
    case 'ageAsc':
      return sorted.sort((a, b) => a.age - b.age);
    case 'ageDesc':
      return sorted.sort((a, b) => b.age - a.age);
    case 'active':
      return sorted.sort((a, b) => timestamp(b.lastActiveAt) - timestamp(a.lastActiveAt));
    case 'justJoined':
      return sorted.sort((a, b) => timestamp(b.joinedAt) - timestamp(a.joinedAt));
    case 'freeToChat':
      // Anyone there's no thread with yet comes first — they can still take a chat.
      return sorted.sort((a, b) => Number(chattingWith.has(a.id)) - Number(chattingWith.has(b.id)));
    case 'verified': {
      const badges = (p: T) => Number(Boolean(p.selfieVerified)) + Number(Boolean(p.bureauVerified));
      return sorted.sort((a, b) => badges(b) - badges(a));
    }
    case 'completeBio': {
      const depth = (p: T) => (p.bio?.trim().length ?? 0) + (p.familyBackground?.trim().length ?? 0);
      return sorted.sort((a, b) => depth(b) - depth(a));
    }
    case 'nearest':
    default: {
      // Real distances first, then anyone sharing the member's city, then the rest.
      const rank = (p: T) => {
        if (p.distanceKm !== undefined) return p.distanceKm;
        if (user?.city && p.city?.toLowerCase() === user.city.toLowerCase()) return 1_000;
        return 1_000_000;
      };
      return sorted.sort((a, b) => rank(a) - rank(b));
    }
  }
}

export function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, setActiveMode } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { confirm, notify } = useDialog();
  const { recordLike } = useLikeLimit();
  const { isBoostActive } = useBoost();
  const { datingProfiles, rishtaProfiles, loading, reload } = useDiscovery();
  const { matches, rishtaProfileIds, blockedProfiles, getOrCreateMatchForProfile, blockMatch } = useMatches();
  const { addNotification, unreadCount } = useNotifications();
  const { recordView } = useViewHistory();
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);
  const [datingCursor, setDatingCursor] = useState(0);
  const [rishtaCursor, setRishtaCursor] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [boostVisible, setBoostVisible] = useState(false);
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const [sort, setSort] = useState<BrowseSortKey>(DEFAULT_BROWSE_SORT);
  const insets = useSafeAreaInsets();
  const onScroll = useHideTabBarOnScroll();

  const mode: ProfileMode = user?.activeMode ?? 'dating';
  const accent = modeAccent(colors, mode);

  const chattingWith = useMemo(
    () => new Set(matches.map((m) => m.sourceProfileId).filter((id): id is string => Boolean(id))),
    [matches]
  );

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.sourceProfileId).filter(Boolean)),
    [blockedProfiles]
  );

  // Anyone whose thread moved to Rishta is off the Friends deck for good — they
  // only come round again on the Rishta side.
  const visibleDatingProfiles = useMemo(
    () =>
      oppositeGenderProfiles(datingProfiles, user?.gender).filter(
        (p) => !blockedProfileIds.has(p.id) && !rishtaProfileIds.has(p.id)
      ),
    [datingProfiles, user?.gender, blockedProfileIds, rishtaProfileIds]
  );
  const visibleRishtaProfiles = useMemo(
    () => oppositeGenderProfiles(rishtaProfiles, user?.gender).filter((p) => !blockedProfileIds.has(p.id)),
    [rishtaProfiles, user?.gender, blockedProfileIds]
  );

  const deck: (DiscoverProfile | RishtaListingProfile)[] = mode === 'dating' ? visibleDatingProfiles : visibleRishtaProfiles;

  // The browse bar's filters and sort are applied on top of the mode's own deck.
  const visibleProfiles = useMemo(() => {
    let list = deck.filter((p) => p.age >= filters.ageMin && p.age <= filters.ageMax);
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
    if (filters.activeToday) list = list.filter((p) => isActiveToday(p.lastActiveAt));
    return sortProfiles(list, sort, { user: user ?? null, mode, chattingWith });
  }, [deck, filters, sort, user, mode, chattingWith]);

  const cursor = mode === 'dating' ? datingCursor : rishtaCursor;
  const setCursor = mode === 'dating' ? setDatingCursor : setRishtaCursor;

  const safeCursor = Math.min(cursor, visibleProfiles.length);
  const currentProfile = visibleProfiles[safeCursor];
  const canUndo = safeCursor > 0;
  const filtersActive = countActiveFilters(filters);

  // A re-filtered or re-sorted deck is a different deck — start it from the top
  // instead of landing mid-way through it.
  useEffect(() => {
    setDatingCursor(0);
    setRishtaCursor(0);
  }, [filters, sort]);

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
    toggleFavorite({ id: profile.id, kind: mode, name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] });
    if (!wasLiked) {
      if (mode === 'dating') {
        setCelebration({ name: profile.name, photo: profile.photos[0] });
        addNotification('match', t('matches.itsAMatch'), t('matches.youAndLikedEachOther', { name: profile.name }));
      } else {
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
      // User dismissed the share sheet — nothing to do.
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
    const match = await getOrCreateMatchForProfile({ id: profile.id, name: profile.name, photo: profile.photos[0], mode });
    blockMatch(match.id);
  };

  const onSubmitReport = async (_reason: string) => {
    setReportVisible(false);
    await notify({ title: t('chat.reportSentTitle'), message: t('chat.reportSentBody') });
  };

  const onSendCompliment = async (_text: string) => {
    if (!currentProfile) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await notify({ title: t('discover.complimentSentTitle'), message: t('discover.complimentSentBody', { name: currentProfile.name }) });
  };

  if (!user) return null;

  const actionBarBottom = TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.sm;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Drifting colour behind everything, repainted per mode. Decorative only. */}
      <AuroraBackground colors={colors} mode={mode} />

      <HomeTopBar
        activeFilterCount={filtersActive}
        onOpenFilters={() => setFiltersVisible(true)}
        onOpenSort={() => setSortVisible(true)}
        onBoost={() => setBoostVisible(true)}
        boostActive={isBoostActive}
        notificationCount={unreadCount}
        onNotifications={() => router.push('/notifications')}
        mode={mode}
      />

      {/* Friends / Rishta decks are separate — this is how a member switches
          between them without leaving Home. */}
      <View style={styles.toggleWrap}>
        <ModeToggle
          mode={mode}
          onChange={setActiveMode}
          datingLabel={t('profile.datingMode')}
          rishtaLabel={t('profile.rishtaMode')}
        />
      </View>

      {currentProfile ? (
        <Animated.View key={`${mode}-${currentProfile.id}`} entering={ZoomIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.flex}>
          {/* The action bar floats over this scroll view, so the content reserves
              its height (plus the tab bar) at the bottom instead of ending flush. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
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
                mode={mode}
                onPressPhoto={setPreviewUri}
              />
            </SwipeableCard>

            <MatchScoreCard
              name={currentProfile.name}
              score={compatibilityScore}
              bureauVerified={Boolean(currentProfile.bureauVerified)}
              mode={mode}
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
            mode={mode}
          />
        </Animated.View>
      ) : (
        <Animated.View entering={ReanimatedFadeIn.duration(240)} style={styles.emptyState}>
          <LinearGradient
            colors={accent.ramp}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.emptyOrb, glow(accent.primary, 0.55, 24, 10)]}
          >
            <Ionicons name="sparkles" size={34} color="#FFFFFF" />
          </LinearGradient>
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
        mode={mode}
        onChange={setFilters}
        onClose={() => setFiltersVisible(false)}
      />

      <BrowseSortSheet visible={sortVisible} sort={sort} onChange={setSort} onClose={() => setSortVisible(false)} />

      <BoostSheet
        visible={boostVisible}
        onClose={() => setBoostVisible(false)}
        onGetMore={() => {
          setBoostVisible(false);
          router.push('/explore-plus');
        }}
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
    toggleWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    emptyOrb: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
    emptyResetButton: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    emptyResetLabel: { ...typography.label, color: '#FFFFFF', fontWeight: '800', fontSize: scaleFont(13) },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: '100%', height: '80%' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
