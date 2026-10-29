import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { PhotoPreview } from '../../components/common/PhotoPreview';
import { Badge } from '../../components/common/Badge';
import { Chip } from '../../components/common/Chip';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/common/IconButton';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
import {
  AboutMeSection,
  ReadinessSection,
  FaithSection,
  FuturePlansSection,
  EducationCareerSection,
  LanguagesBackgroundSection,
  MidProfilePhoto,
  IntroMediaSection,
} from '../../components/discover/ProfileDetailSections';
import { useDiscovery } from '../../store/DiscoveryContext';
import { discoveryService } from '../../services/discoveryService';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';
import { useLanguage } from '../../store/LanguageContext';
import { vocabularyLabel } from '../../i18n/vocabulary';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useDialog } from '../../store/DialogContext';
import { useMatches } from '../../store/MatchesContext';
import { useFavorites } from '../../store/FavoritesContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { useActivityHistory } from '../../store/ActivityHistoryContext';
import { datingCompatibility, rishtaCompatibility } from '../../utils/compatibility';
import { fonts, radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { FREE_MATCH_SCORE } from '../../config/features';

const READINESS_KEY: Record<string, string> = {
  browsing: 'profile.readinessBrowsing',
  few_months: 'profile.readinessFewMonths',
  ready_now: 'profile.readinessNow',
};

export function ProfileDetailScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { notify } = useDialog();
  const { getMatchForProfile } = useMatches();
  const { datingProfiles, rishtaProfiles } = useDiscovery();
  const { isFavorite, isLiked, toggleLike, toggleFavorite } = useFavorites();
  const { recordView } = useViewHistory();
  const { recordPass, unhideLiked } = useActivityHistory();
  const { kind, id } = useLocalSearchParams<{ kind: 'dating' | 'rishta'; id: string }>();

  const [galleryWidth, setGalleryWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const datingProfile = kind === 'dating' ? datingProfiles.find((p) => p.id === id) : undefined;
  const rishtaProfile = kind === 'rishta' ? rishtaProfiles.find((p) => p.id === id) : undefined;
  const listed = datingProfile ?? rishtaProfile;

  // A match opened from Messages may not be in the deck pages fetched so far
  // (the deck loads a page at a time), so fetch that one profile instead of
  // showing an empty screen.
  const [fetched, setFetched] = useState<DiscoverProfile | RishtaListingProfile | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  useEffect(() => {
    if (listed || !id) return;
    let alive = true;
    setFetchFailed(false);
    discoveryService
      .fetchProfileById(id, kind === 'rishta' ? 'rishta' : 'dating')
      .then((p) => {
        if (!alive) return;
        if (p) setFetched(p);
        else setFetchFailed(true);
      })
      .catch(() => alive && setFetchFailed(true));
    return () => {
      alive = false;
    };
  }, [id, kind, Boolean(listed)]);
  const profile = listed ?? (fetched?.id === id ? fetched : undefined);

  useEffect(() => {
    if (!profile) return;
    recordView({ id: profile.id, kind, name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, kind]);

  if (!user) return null;
  if (!profile) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingWrap]}>
        {fetchFailed ? (
          <Text style={styles.loadingText}>{t('common.somethingWentWrong')}</Text>
        ) : (
          <ActivityIndicator color={colors.teal} />
        )}
      </SafeAreaView>
    );
  }

  const scoreOpen = Boolean(user.isExplorePlus) || FREE_MATCH_SCORE;
  const compatibilityScore = kind === 'dating' ? datingCompatibility(user, profile as DiscoverProfile) : rishtaCompatibility(user, profile as RishtaListingProfile);
  // The profile is browsed from one deck or the other, so it wears that deck's ramp.
  const detailRamp = modeAccent(colors, kind === 'rishta' ? 'rishta' : 'dating').ramp;
  const photosHidden = Boolean(profile.photosBlurred);

  const onGalleryLayout = (e: LayoutChangeEvent) => setGalleryWidth(e.nativeEvent.layout.width);
  // Read once the swipe has settled, not on every scroll frame: updating the
  // dots mid-swipe re-rendered the whole profile while the photo was moving,
  // which is what made the gallery stutter.
  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (galleryWidth === 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / galleryWidth);
    setActiveIndex(index);
  };

  const asFavorite = { id: profile.id, kind, name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] };
  // The star: a private save to Favorites, nothing sent to them.
  const onToggleFavorite = () => toggleFavorite(asFavorite);

  // What the action bar shows: a like can only be sent once, so once it's out
  // the button says so instead of looking untouched (pressing "Like" on someone
  // already liked or matched used to do nothing, silently), and a match turns
  // the bar into the way to message them.
  const match = getMatchForProfile(profile.id);
  const liked = isLiked(profile.id);

  const onPass = () => {
    recordPass({ id: profile.id, kind, name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] ?? '' });
    router.back();
  };
  // Like (Friends) and Express interest (Rishta) are the same like underneath,
  // so they share one path: the daily-cap popup, and the match celebration
  // when this like is the one that made it mutual.
  const onLike = async () => {
    if (liked) return;
    let outcome: Awaited<ReturnType<typeof toggleLike>> = null;
    try {
      outcome = await toggleLike(asFavorite);
    } catch {
      // Out of free likes for today; the cap is refused server-side.
      await notify({ title: t('discover.limitReachedTitle'), message: t('discover.limitReachedBody') });
      return;
    }
    unhideLiked(profile.id);
    if (outcome?.isNew) {
      setCelebration({ name: profile.name, photo: profile.photos[0] ?? '' });
      return;
    }
    if (kind === 'rishta') {
      await notify({
        title: t('profileDetail.interestSentTitle'),
        message: t('profileDetail.interestSentBody', { name: profile.name }),
      });
    }
  };
  const onMessage = async () => {
    // A conversation needs both sides now: the shared `matches` row cannot be
    // written until the like is mutual (supabase/24_matching.sql). Until then
    // there is nothing to open, so say so rather than failing silently.
    const match = getMatchForProfile(profile.id);
    if (!match) {
      await notify({
        title: t('profileDetail.messageLockedTitle'),
        message: t('profileDetail.messageLockedBody', { name: profile.name }),
      });
      return;
    }
    // Back to the chat when it's already open underneath (chat → profile →
    // "Message"), rather than stacking a second copy of it.
    router.dismissTo(`/chat/${match.id}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.galleryWrap} onLayout={onGalleryLayout}>
          {galleryWidth > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              // Always come to rest on a whole photo, even after a slow or short
              // drag, instead of stopping with two halves on screen.
              snapToInterval={galleryWidth}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              nestedScrollEnabled
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onGalleryScroll}
            >
              {profile.photos.map((uri) => (
                // `resize` decodes the photo at the size it's shown rather than
                // full camera resolution (Android), so swiping isn't held up by
                // decoding a multi-megapixel image.
                <Image
                  key={uri}
                  source={{ uri }}
                  resizeMethod="resize"
                  style={[styles.galleryImage, { width: galleryWidth }]}
                />
              ))}
            </ScrollView>
          )}

          {/* Aubergine wash at the foot, so the sheet below rises out of it. */}
          <LinearGradient
            colors={['transparent', 'rgba(36,31,33,0.55)']}
            style={styles.galleryScrim}
            pointerEvents="none"
          />

          {photosHidden && (
            // Android's BlurView renders as a flat, un-blurred tint unless
            // this is set — it defaults to 'none' there, unlike iOS.
            <BlurView
              intensity={50}
              tint={isDark ? 'dark' : 'light'}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            >
              <View style={styles.blurOverlay}>
                <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
                <Text style={styles.blurText}>{t('profileDetail.photosHidden')}</Text>
              </View>
            </BlurView>
          )}

          <View style={styles.galleryOverlayTop}>
            <IconButton
              icon={rtl ? 'chevron-forward' : 'chevron-back'}
              onPress={() => router.back()}
              background={GLASS}
              color="#FFFFFF"
              style={styles.noBorder}
            />
            <View style={styles.overlayRight}>
              {kind === 'rishta' && (
                <Badge label={t(READINESS_KEY[(profile as RishtaListingProfile).readiness])} tone="rishta" />
              )}
              <IconButton
                icon={isFavorite(profile.id) ? 'star' : 'star-outline'}
                onPress={onToggleFavorite}
                background={GLASS}
                color={isFavorite(profile.id) ? colors.gold : '#FFFFFF'}
                style={styles.noBorder}
              />
            </View>
          </View>

          {profile.photos.length > 1 && (
            <View style={styles.dotsRow}>
              {profile.photos.map((_, index) => (
                <View key={index} style={[styles.dot, index === activeIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <Animated.View entering={FadeInUp.duration(380)} style={styles.content}>
          <View style={[styles.flourish, rtl && styles.flourishRtl]}>
            <View style={styles.flourishLine} />
            <View style={styles.flourishDiamond} />
            <View style={styles.flourishLine} />
          </View>
          <Text style={[styles.name, rtl && styles.rtlText]}>
            {profile.name}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.gold} />
            <Text style={styles.metaText}>{vocabularyLabel(profile.city, t)}</Text>
          </View>

          {/* The score is an Explore+ feature, same as on Home's card. */}
          <Pressable
            disabled={scoreOpen}
            onPress={() => router.push('/explore-plus')}
            style={[styles.compatibilityBanner, glow(detailRamp[0], 0.12, 18, 4), rtl && styles.rowRtl]}
          >
            <LinearGradient
              colors={detailRamp}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.compatibilitySeal}
            >
              <Ionicons name={scoreOpen ? 'sparkles' : 'lock-closed'} size={18} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.compatibilityTitle, rtl && styles.rtlText]}>
              {scoreOpen
                ? t('profile.aiScoreValue', { score: compatibilityScore })
                : t('profile.aiScoreLocked')}
            </Text>
          </Pressable>

          {kind === 'dating' && (profile as DiscoverProfile).vibeTags?.length > 0 && (
            <View style={styles.chipRow}>
              {(profile as DiscoverProfile).vibeTags.map((tag) => (
                <Chip key={tag} label={tag} tone="dating" selected />
              ))}
            </View>
          )}

          {profile.bio && (
            <View style={styles.card}>
              <AccentHeading title={t('profile.about')} gradient={detailRamp} style={styles.sectionHeading} />
              <Text style={[styles.bio, rtl && styles.rtlText]}>{profile.bio}</Text>
            </View>
          )}

          {profile.familyBackground && (
            <View style={styles.card}>
              <AccentHeading title={t('rishtaProfile.title')} gradient={detailRamp} style={styles.sectionHeading} />
              <Text style={[styles.bio, rtl && styles.rtlText]}>{profile.familyBackground}</Text>
            </View>
          )}

          {/* Hidden with the gallery when this member blurs their photos. */}
          {!photosHidden && <MidProfilePhoto photos={profile.photos} onPress={() => setPreviewUri(profile.photos[1])} />}
          <IntroMediaSection profile={profile} />

          <AboutMeSection profile={profile} />
          <ReadinessSection profile={profile} />
          <FaithSection profile={profile} />
          <FuturePlansSection profile={profile} />
          <EducationCareerSection profile={profile} />
          <LanguagesBackgroundSection profile={profile} />
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.actionBar}>
        {match ? (
          <View style={styles.primaryRow}>
            <Button
              label={t('profileDetail.matchedMessage')}
              onPress={onMessage}
              gradient={detailRamp}
              icon={<Ionicons name="chatbubble" size={16} color="#FFFFFF" />}
              style={styles.fullButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.contactRow}>
              <Pressable onPress={onMessage} style={styles.contactButton}>
                <Ionicons name="chatbubble-outline" size={17} color={colors.teal} />
                <Text style={styles.contactLabel}>{t('profileDetail.message')}</Text>
              </Pressable>
            </View>
            <View style={styles.primaryRow}>
              <Button
                singleLine
                label={kind === 'rishta' ? t('profileDetail.notNow') : t('discover.pass')}
                variant="secondary"
                onPress={onPass}
                style={{ ...styles.actionButton, ...styles.outlineButton }}
                labelStyle={styles.outlineLabel}
              />
              {liked ? (
                // Sent: a white button with a filled heart, so it reads as done
                // rather than greyed out, and it can't send the like twice.
                <Button
                  singleLine
                  label={kind === 'rishta' ? t('profileDetail.interestSent') : t('profileDetail.liked')}
                  onPress={onLike}
                  disabled
                  variant="secondary"
                  icon={<Ionicons name="heart" size={16} color={detailRamp[0]} />}
                  style={{ ...styles.actionButton, ...styles.likedButton, borderColor: detailRamp[0] }}
                  labelStyle={{ color: detailRamp[0] }}
                />
              ) : (
                <Button
                  singleLine
                  label={kind === 'rishta' ? t('profileDetail.expressInterest') : t('discover.like')}
                  onPress={onLike}
                  gradient={detailRamp}
                  icon={<Ionicons name="heart-outline" size={16} color="#FFFFFF" />}
                  style={styles.actionButton}
                />
              )}
            </View>
            {liked && (
              <View style={[styles.sentRow, rtl && styles.sentRowRtl]}>
                <Ionicons name="notifications-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.sentText, rtl && styles.rtlText]}>
                  {t('profileDetail.likeSentHint', { name: profile.name })}
                </Text>
              </View>
            )}
          </>
        )}
      </Animated.View>

      <PhotoPreview uri={previewUri} onClose={() => setPreviewUri(null)} />

      <MatchCelebration
        visible={Boolean(celebration)}
        name={celebration?.name ?? ''}
        photo={celebration?.photo ?? ''}
        onClose={() => {
          setCelebration(null);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

// Dark glass for the buttons floating on the photo.
const GLASS = 'rgba(36,31,33,0.45)';

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    loadingWrap: { alignItems: 'center', justifyContent: 'center' },
    loadingText: { ...typography.body, color: colors.textSecondary },
    galleryWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.skeleton },
    galleryImage: { height: '100%' },
    galleryScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%' },
    blurOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
    blurText: { ...typography.label, color: '#FFFFFF' },
    galleryOverlayTop: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    noBorder: { borderWidth: 0 },
    overlayRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    // Above the sheet's rounded lip, which overlaps the gallery's foot.
    dotsRow: { position: 'absolute', bottom: spacing.xl + spacing.sm, alignSelf: 'center', flexDirection: 'row', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive: { backgroundColor: colors.gold, width: 20 },
    // An ivory sheet rising over the photo's foot.
    content: {
      padding: spacing.lg,
      paddingBottom: 170,
      marginTop: -spacing.xl,
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg + 4,
      borderTopRightRadius: radius.lg + 4,
    },
    flourish: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    flourishRtl: { alignSelf: 'flex-end' },
    flourishLine: { width: 24, height: 1, backgroundColor: colors.gold },
    flourishDiamond: { width: 6, height: 6, backgroundColor: colors.gold, transform: [{ rotate: '45deg' }] },
    rowRtl: { flexDirection: 'row-reverse' },
    name: { ...typography.h1, color: colors.textPrimary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, marginBottom: spacing.md },
    metaText: {
      ...typography.caption,
      fontFamily: fonts.bodyBold,
      color: colors.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    card: { ...cardSurface(colors), marginTop: spacing.md, paddingBottom: spacing.lg },
    sectionHeading: { marginBottom: spacing.sm },
    bio: { ...typography.body, color: colors.textPrimary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    compatibilityBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.5),
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    compatibilitySeal: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compatibilityTitle: { ...typography.h3, color: colors.textPrimary, flexShrink: 1 },
    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing.lg,
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: radius.lg + 4,
      borderTopRightRadius: radius.lg + 4,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      shadowColor: '#241F21',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      elevation: 16,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    // Two blush pills side by side.
    contactButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.tealSoft,
    },
    contactLabel: { ...typography.label, color: colors.teal },
    primaryRow: { flexDirection: 'row', gap: spacing.sm },
    // Less side padding than Button's default so a label plus its heart fits
    // one line in half the row.
    actionButton: { flex: 1, paddingHorizontal: spacing.md },
    // Secondary action per the design system: outlined champagne-gold pill.
    outlineButton: { borderColor: colors.gold, backgroundColor: 'transparent' },
    outlineLabel: { color: colors.textPrimary },
    fullButton: { flex: 1 },
    // Overrides Button's disabled fade: a sent like is done, not unavailable.
    likedButton: { opacity: 1, borderWidth: 1.5, backgroundColor: colors.surface },
    sentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
    sentRowRtl: { flexDirection: 'row-reverse' },
    sentText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
