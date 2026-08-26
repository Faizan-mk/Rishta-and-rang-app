import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn as ReanimatedFadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { MainTabScreenProps } from '../../navigation/types';
import { DiscoverProfileCard } from '../../components/discover/DiscoverProfileCard';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
import { ModeToggle } from '../../components/profile/ModeToggle';
import {
  AboutMeSection,
  MarriageIntentionsCard,
  FaithSection,
  FuturePlansSection,
  EducationCareerSection,
  LanguagesBackgroundSection,
  VerificationSection,
  MidProfilePhoto,
  IntroMediaSection,
} from '../../components/discover/ProfileDetailSections';
import { ProfileActionsFooter } from '../../components/discover/ProfileActionsFooter';
import { ProfileUtilityBar } from '../../components/discover/ProfileUtilityBar';
import { ReportDialog } from '../../components/common/ReportDialog';
import { Chip } from '../../components/common/Chip';
import { Badge } from '../../components/common/Badge';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';
import type { ProfileMode } from '../../types/user';
import { useDiscovery } from '../../store/DiscoveryContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useFavorites } from '../../store/FavoritesContext';
import { useDialog } from '../../store/DialogContext';
import { useLikeLimit } from '../../store/LikeLimitContext';
import { useMatches } from '../../store/MatchesContext';
import { useNotifications } from '../../store/NotificationContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { datingCompatibility, rishtaCompatibility } from '../../utils/compatibility';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = MainTabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, setActiveMode } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { confirm, notify } = useDialog();
  const { isUnlimited, remaining, recordLike } = useLikeLimit();
  const { datingProfiles, rishtaProfiles } = useDiscovery();
  const { blockedProfiles, getOrCreateMatchForProfile, blockMatch } = useMatches();
  const { addNotification } = useNotifications();
  const { recordView } = useViewHistory();
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);
  const [datingCursor, setDatingCursor] = useState(0);
  const [rishtaCursor, setRishtaCursor] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const onScroll = useHideTabBarOnScroll();

  const mode: ProfileMode = user?.activeMode ?? 'dating';

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.sourceProfileId).filter(Boolean)),
    [blockedProfiles]
  );

  const visibleDatingProfiles = useMemo(
    () => oppositeGenderProfiles(datingProfiles, user?.gender).filter((p) => !blockedProfileIds.has(p.id)),
    [datingProfiles, user?.gender, blockedProfileIds]
  );
  const visibleRishtaProfiles = useMemo(
    () => oppositeGenderProfiles(rishtaProfiles, user?.gender).filter((p) => !blockedProfileIds.has(p.id)),
    [rishtaProfiles, user?.gender, blockedProfileIds]
  );

  const visibleProfiles: (DiscoverProfile | RishtaListingProfile)[] = mode === 'dating' ? visibleDatingProfiles : visibleRishtaProfiles;
  const cursor = mode === 'dating' ? datingCursor : rishtaCursor;
  const setCursor = mode === 'dating' ? setDatingCursor : setRishtaCursor;

  const safeCursor = Math.min(cursor, visibleProfiles.length);
  const currentProfile = visibleProfiles[safeCursor];
  const canUndo = safeCursor > 0;

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

  const onUndo = async () => {
    if (!canUndo) return;
    if (!user?.isExplorePlus) {
      const wantsUpgrade = await confirm({
        title: t('discover.rewindLockedTitle'),
        message: t('discover.rewindLockedBody'),
        confirmLabel: t('explorePlus.upgrade'),
        cancelLabel: t('common.cancel'),
      });
      if (wantsUpgrade) navigation.navigate('ExplorePlus');
      return;
    }
    setCursor((c) => Math.max(c - 1, 0));
  };

  const onPass = () => {
    if (!currentProfile) return;
    advance();
  };

  const onLike = async () => {
    if (!currentProfile) return;
    const profile = currentProfile;
    const wasLiked = isFavorite(profile.id);
    if (!wasLiked) {
      const allowed = recordLike();
      if (!allowed) {
        const wantsUpgrade = await confirm({
          title: t('discover.limitReachedTitle'),
          message: t('discover.limitReachedBody'),
          confirmLabel: t('explorePlus.upgrade'),
          cancelLabel: t('common.cancel'),
        });
        if (wantsUpgrade) {
          navigation.navigate('ExplorePlus');
          return;
        }
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('nav.home')}</Text>
        {mode === 'dating' && !isUnlimited && (
          <View style={styles.likesBadge}>
            <Ionicons name="heart" size={12} color={colors.teal} />
            <Text style={styles.likesBadgeText}>{t('discover.likesRemaining', { count: remaining })}</Text>
          </View>
        )}
      </View>

      <View style={styles.toggleWrap}>
        <ModeToggle mode={mode} onChange={setActiveMode} datingLabel={t('profile.datingMode')} rishtaLabel={t('profile.rishtaMode')} />
      </View>

      {currentProfile ? (
        <Animated.View key={`${mode}-${currentProfile.id}`} entering={ZoomIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.flex}>
          {/* No bottom padding to reserve here: the action row below is a normal
              sibling in the column, not an overlay, so it can't cover the last
              card. `styles.content` already ends with its own spacing.lg. */}
          <ScrollView showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
            <DiscoverProfileCard profile={currentProfile} liked={isFavorite(currentProfile.id)} onPressPhoto={setPreviewUri} />

            <View style={styles.content}>
              {(currentProfile.vibeTags ?? []).length > 0 && (
                <View style={styles.chipRow}>
                  {(currentProfile.vibeTags ?? []).map((tag) => (
                    <Chip key={tag} label={tag} tone={mode === 'dating' ? 'dating' : 'rishta'} selected />
                  ))}
                </View>
              )}

              <View style={styles.compatibilityBanner}>
                <Ionicons name="sparkles" size={18} color={colors.gold} />
                <View style={styles.compatibilityTextWrap}>
                  <Text style={[styles.compatibilityTitle, rtl && styles.rtlText]}>
                    {t('profile.aiScoreValue', { score: compatibilityScore })}
                  </Text>
                  <Badge
                    label={currentProfile.bureauVerified ? t('profile.bureau') : t('profile.bureauNotVerified')}
                    tone={currentProfile.bureauVerified ? 'success' : 'neutral'}
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('discover.similaritiesTitle')}</Text>
              {similarities.length > 0 ? (
                <>
                  <Text style={[styles.sectionSubtitle, rtl && styles.rtlText]}>
                    {t('discover.similaritiesSubtitle', { name: currentProfile.name })}
                  </Text>
                  <View style={styles.chipRow}>
                    {similarities.map((label) => (
                      <View key={label} style={styles.similarityChip}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={styles.similarityChipText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={[styles.sectionSubtitle, rtl && styles.rtlText]}>{t('discover.similaritiesEmpty')}</Text>
              )}

              {currentProfile.bio && (
                <>
                  <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.about')}</Text>
                  <Text style={[styles.bio, rtl && styles.rtlText]}>{currentProfile.bio}</Text>
                </>
              )}

              {currentProfile.familyBackground && (
                <>
                  <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('rishtaProfile.title')}</Text>
                  <Text style={[styles.bio, rtl && styles.rtlText]}>{currentProfile.familyBackground}</Text>
                </>
              )}

              <MidProfilePhoto photos={currentProfile.photos} onPress={setPreviewUri} />
              <IntroMediaSection profile={currentProfile} />

              <AboutMeSection profile={currentProfile} />
              <MarriageIntentionsCard profile={currentProfile} />
              <FaithSection profile={currentProfile} />
              <FuturePlansSection profile={currentProfile} />
              <EducationCareerSection profile={currentProfile} />
              <LanguagesBackgroundSection profile={currentProfile} />
              <VerificationSection profile={currentProfile} />

              <ProfileUtilityBar
                liked={isFavorite(currentProfile.id)}
                onShare={onShareProfile}
                onToggleFavourite={onToggleFavourite}
                onBlock={onBlockProfile}
                onReport={() => setReportVisible(true)}
              />

              <ProfileActionsFooter onSendCompliment={onSendCompliment} />
            </View>
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View entering={ReanimatedFadeIn.duration(240)} style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={32} color={colors.textTertiary} />
          <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('discover.outOfProfiles')}</Text>
        </Animated.View>
      )}

      {currentProfile && (
        <View style={[styles.actionsRow, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom }]}>
          <SwipeActionButton onPress={onUndo} disabled={!canUndo} size="small" colors={colors} locked={canUndo && !user.isExplorePlus}>
            <Ionicons name="arrow-undo" size={20} color={canUndo ? colors.gold : colors.textTertiary} />
          </SwipeActionButton>
          <SwipeActionButton onPress={onPass} size="large" colors={colors}>
            <Ionicons name="close" size={30} color={colors.textPrimary} />
          </SwipeActionButton>
          <SwipeActionButton onPress={onLike} size="large" tone="like" colors={colors}>
            <Ionicons name="heart" size={26} color="#FFFFFF" />
          </SwipeActionButton>
        </View>
      )}

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

function SwipeActionButton({
  onPress,
  disabled,
  size,
  tone,
  colors,
  locked,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  size: 'small' | 'large';
  tone?: 'like';
  colors: Palette;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dimension = size === 'small' ? 46 : 62;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          if (disabled) return;
          scale.value = withSpring(0.86, { damping: 14, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10, stiffness: 220 });
        }}
        style={[
          actionButtonStyles.button,
          { width: dimension, height: dimension, backgroundColor: colors.surface, borderColor: colors.border },
          tone === 'like' && { backgroundColor: colors.dating, borderColor: colors.dating },
          disabled && actionButtonStyles.disabled,
        ]}
      >
        {children}
        {locked && (
          <View style={[actionButtonStyles.lockBadge, { backgroundColor: colors.gold, borderColor: colors.background }]}>
            <Ionicons name="lock-closed" size={9} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const actionButtonStyles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  disabled: { opacity: 0.4, shadowOpacity: 0 },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    title: { ...typography.h1, color: colors.textPrimary },
    likesBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.tealSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    likesBadgeText: { ...typography.caption, color: colors.teal, fontWeight: '700' },
    toggleWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    content: { padding: spacing.lg },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    compatibilityBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.goldSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    compatibilityTextWrap: { flex: 1, gap: spacing.xs },
    compatibilityTitle: { ...typography.bodyBold, color: colors.gold },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.xs },
    sectionSubtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
    similarityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.successSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    similarityChipText: { ...typography.caption, color: colors.success, fontWeight: '600' },
    bio: { ...typography.body, color: colors.textPrimary },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.background,
    },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: '100%', height: '80%' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
