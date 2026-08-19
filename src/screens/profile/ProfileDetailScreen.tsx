import React, { useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import type { AppStackScreenProps } from '../../navigation/types';
import { Badge } from '../../components/common/Badge';
import { Chip } from '../../components/common/Chip';
import { Button } from '../../components/common/Button';
import { IconButton } from '../../components/common/IconButton';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
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
import { mockDiscoverProfiles } from '../../data/mockDiscover';
import { mockRishtaProfiles } from '../../data/mockRishta';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useDialog } from '../../store/DialogContext';
import { useMatches } from '../../store/MatchesContext';
import { useFavorites } from '../../store/FavoritesContext';
import { useViewHistory } from '../../store/ViewHistoryContext';
import { datingCompatibility, rishtaCompatibility } from '../../utils/compatibility';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'ProfileDetail'>;

const READINESS_KEY: Record<string, string> = {
  browsing: 'profile.readinessBrowsing',
  few_months: 'profile.readinessFewMonths',
  ready_now: 'profile.readinessNow',
};

export function ProfileDetailScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { notify } = useDialog();
  const { getOrCreateMatchForProfile } = useMatches();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { recordView } = useViewHistory();
  const { kind, id } = route.params;

  const [galleryWidth, setGalleryWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const datingProfile = kind === 'dating' ? mockDiscoverProfiles.find((p) => p.id === id) : undefined;
  const rishtaProfile = kind === 'rishta' ? mockRishtaProfiles.find((p) => p.id === id) : undefined;
  const profile = datingProfile ?? rishtaProfile;

  useEffect(() => {
    if (!profile) return;
    recordView({ id: profile.id, kind, name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, kind]);

  if (!profile || !user) return null;

  const compatibilityScore = kind === 'dating' ? datingCompatibility(user, profile as DiscoverProfile) : rishtaCompatibility(user, profile as RishtaListingProfile);
  const photosHidden = Boolean(profile.photosBlurred) && !isFavorite(profile.id);

  const onGalleryLayout = (e: LayoutChangeEvent) => setGalleryWidth(e.nativeEvent.layout.width);
  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (galleryWidth === 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / galleryWidth);
    setActiveIndex(index);
  };

  const onToggleFavorite = () => {
    toggleFavorite({ id: profile.id, kind, name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] });
  };

  const onPass = () => navigation.goBack();
  const onLike = async () => {
    if (!isFavorite(profile.id)) onToggleFavorite();
    setCelebration({ name: profile.name, photo: profile.photos[0] });
  };
  const onExpressInterest = async () => {
    if (!isFavorite(profile.id)) onToggleFavorite();
    await notify({
      title: t('profileDetail.interestSentTitle'),
      message: t('profileDetail.interestSentBody', { name: profile.name }),
    });
    navigation.goBack();
  };
  const onMessage = () => {
    const match = getOrCreateMatchForProfile({ id: profile.id, name: profile.name, photo: profile.photos[0], mode: kind });
    navigation.navigate('Chat', { matchId: match.id });
  };
  const onCall = () => {
    navigation.navigate('Call', { name: profile.name, photo: profile.photos[0] });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.galleryWrap} onLayout={onGalleryLayout}>
          {galleryWidth > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onGalleryScroll}
              scrollEventThrottle={16}
            >
              {profile.photos.map((uri) => (
                <Image key={uri} source={{ uri }} style={[styles.galleryImage, { width: galleryWidth }]} />
              ))}
            </ScrollView>
          )}

          {photosHidden && (
            <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
              <View style={styles.blurOverlay}>
                <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
                <Text style={styles.blurText}>{t('profileDetail.photosHidden')}</Text>
              </View>
            </BlurView>
          )}

          <View style={styles.galleryOverlayTop}>
            <IconButton
              icon={rtl ? 'chevron-forward' : 'chevron-back'}
              onPress={() => navigation.goBack()}
              background="rgba(0,0,0,0.35)"
              color="#FFFFFF"
              style={styles.noBorder}
            />
            <View style={styles.overlayRight}>
              {kind === 'rishta' && (
                <Badge label={t(READINESS_KEY[(profile as RishtaListingProfile).readiness])} tone="rishta" />
              )}
              <IconButton
                icon={isFavorite(profile.id) ? 'heart' : 'heart-outline'}
                onPress={onToggleFavorite}
                background="rgba(0,0,0,0.35)"
                color={isFavorite(profile.id) ? colors.dating : '#FFFFFF'}
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
          <Text style={[styles.name, rtl && styles.rtlText]}>
            {profile.name}, {profile.age}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{profile.city}</Text>
          </View>

          <View style={styles.compatibilityBanner}>
            <Ionicons name="sparkles" size={18} color={colors.gold} />
            <Text style={[styles.compatibilityTitle, rtl && styles.rtlText]}>
              {t('profile.aiScoreValue', { score: compatibilityScore })}
            </Text>
          </View>

          {kind === 'dating' && (profile as DiscoverProfile).vibeTags?.length > 0 && (
            <View style={styles.chipRow}>
              {(profile as DiscoverProfile).vibeTags.map((tag) => (
                <Chip key={tag} label={tag} tone="dating" selected />
              ))}
            </View>
          )}

          {profile.bio && (
            <>
              <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.about')}</Text>
              <Text style={[styles.bio, rtl && styles.rtlText]}>{profile.bio}</Text>
            </>
          )}

          {profile.familyBackground && (
            <>
              <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('rishtaProfile.title')}</Text>
              <Text style={[styles.bio, rtl && styles.rtlText]}>{profile.familyBackground}</Text>
            </>
          )}

          <MidProfilePhoto photos={profile.photos} onPress={() => setPreviewUri(profile.photos[1])} />
          <IntroMediaSection profile={profile} />

          <AboutMeSection profile={profile} />
          <MarriageIntentionsCard profile={profile} />
          <FaithSection profile={profile} />
          <FuturePlansSection profile={profile} />
          <EducationCareerSection profile={profile} />
          <LanguagesBackgroundSection profile={profile} />
          <VerificationSection profile={profile} />
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.actionBar}>
        <View style={styles.contactRow}>
          <Pressable onPress={onMessage} style={styles.contactButton}>
            <Ionicons name="chatbubble-outline" size={17} color={colors.teal} />
            <Text style={styles.contactLabel}>{t('profileDetail.message')}</Text>
          </Pressable>
          <View style={styles.contactDivider} />
          <Pressable onPress={onCall} style={styles.contactButton}>
            <Ionicons name="call-outline" size={17} color={colors.teal} />
            <Text style={styles.contactLabel}>{t('profileDetail.call')}</Text>
          </Pressable>
        </View>
        <View style={styles.primaryRow}>
          {kind === 'dating' ? (
            <>
              <Button label={t('discover.pass')} variant="secondary" onPress={onPass} style={styles.actionButton} />
              <Button label={t('discover.like')} onPress={onLike} style={styles.actionButton} />
            </>
          ) : (
            <Button label={t('profileDetail.expressInterest')} onPress={onExpressInterest} style={styles.fullButton} />
          )}
        </View>
      </Animated.View>

      <Modal visible={Boolean(previewUri)} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewUri(null)}>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />}
        </Pressable>
      </Modal>

      <MatchCelebration
        visible={Boolean(celebration)}
        name={celebration?.name ?? ''}
        photo={celebration?.photo ?? ''}
        onClose={() => {
          setCelebration(null);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    galleryWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.skeleton },
    galleryImage: { height: '100%' },
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
    dotsRow: { position: 'absolute', bottom: spacing.sm, alignSelf: 'center', flexDirection: 'row', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive: { backgroundColor: '#FFFFFF', width: 18 },
    content: { padding: spacing.lg, paddingBottom: 150 },
    name: { ...typography.h1, color: colors.textPrimary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, marginBottom: spacing.md },
    metaText: { ...typography.body, color: colors.textSecondary },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
    bio: { ...typography.body, color: colors.textPrimary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    compatibilityBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.goldSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    compatibilityTitle: { ...typography.bodyBold, color: colors.gold },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: '100%', height: '80%' },
    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    contactButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.xs,
    },
    contactDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginVertical: 2 },
    contactLabel: { ...typography.label, color: colors.teal },
    primaryRow: { flexDirection: 'row', gap: spacing.sm },
    actionButton: { flex: 1 },
    fullButton: { flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
