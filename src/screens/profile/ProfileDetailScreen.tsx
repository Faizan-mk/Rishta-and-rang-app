import React, { useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import type { AppStackScreenProps } from '../../navigation/types';
import { Badge } from '../../components/common/Badge';
import { Chip } from '../../components/common/Chip';
import { Button } from '../../components/common/Button';
import { IconButton } from '../../components/common/IconButton';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
import { mockDiscoverProfiles } from '../../data/mockDiscover';
import { mockRishtaProfiles } from '../../data/mockRishta';
import type { DiscoverProfile, RishtaListingProfile } from '../../types/content';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useMatches } from '../../store/MatchesContext';
import { useFavorites } from '../../store/FavoritesContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'ProfileDetail'>;

const READINESS_KEY: Record<string, string> = {
  browsing: 'profile.readinessBrowsing',
  few_months: 'profile.readinessFewMonths',
  ready_now: 'profile.readinessNow',
};

export function ProfileDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { notify } = useDialog();
  const { getOrCreateMatchForProfile } = useMatches();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { kind, id } = route.params;

  const [galleryWidth, setGalleryWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);

  const datingProfile = kind === 'dating' ? mockDiscoverProfiles.find((p) => p.id === id) : undefined;
  const rishtaProfile = kind === 'rishta' ? mockRishtaProfiles.find((p) => p.id === id) : undefined;
  const profile = datingProfile ?? rishtaProfile;

  if (!profile) return null;

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

          {kind === 'dating' ? (
            <>
              <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.about')}</Text>
              <Text style={[styles.bio, rtl && styles.rtlText]}>{(profile as DiscoverProfile).bio}</Text>

              <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.vibeTags')}</Text>
              <View style={styles.chipRow}>
                {(profile as DiscoverProfile).vibeTags.map((tag) => (
                  <Chip key={tag} label={tag} tone="dating" selected />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.detailCard}>
              <DetailRow label={t('profile.religion')} value={(profile as RishtaListingProfile).religion} rtl={rtl} />
              <DetailRow label={t('profile.sect')} value={(profile as RishtaListingProfile).sect} rtl={rtl} />
              <DetailRow label={t('profile.education')} value={(profile as RishtaListingProfile).education} rtl={rtl} />
              <DetailRow
                label={t('profile.readiness')}
                value={t(READINESS_KEY[(profile as RishtaListingProfile).readiness])}
                rtl={rtl}
              />
              <DetailRow
                label={t('profile.familyBackground')}
                value={(profile as RishtaListingProfile).familyBackground}
                rtl={rtl}
                last
              />
            </View>
          )}

          <View style={styles.lockedSection}>
            <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('profile.comingInV2')}</Text>
            <View style={styles.chipRow}>
              <Badge label={t('profile.aiScore')} tone="locked" />
              <Badge label={t('profile.bureau')} tone="locked" />
            </View>
          </View>
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

function DetailRow({ label, value, rtl, last }: { label: string; value: string; rtl: boolean; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        detailStyles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
        rtl && { flexDirection: 'row-reverse' },
      ]}
    >
      <Text style={[detailStyles.label, { color: colors.textSecondary }, rtl && detailStyles.rtlText]}>{label}</Text>
      <Text style={[detailStyles.value, { color: colors.textPrimary }, rtl && detailStyles.rtlText]}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  label: { ...typography.body },
  value: { ...typography.bodyBold, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    galleryWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.skeleton },
    galleryImage: { height: '100%' },
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
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    lockedSection: { marginTop: spacing.md },
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
