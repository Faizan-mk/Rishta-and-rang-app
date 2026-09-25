import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SmartImage } from '../common/SmartImage';
import type { BrowseProfile } from '../../types/content';
import type { ProfileMode } from '../../types/user';
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleFont, scaleSpace } from '../../theme/responsive';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import { ONLINE_GREEN, type Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { vocabularyLabel } from '../../i18n/vocabulary';
import { activityLevel, type ActivityLevel } from '../../utils/time';

// Reads the same in both themes, so it isn't a palette token. The one
// definition lives in the theme — the chat header's dot shows the same green.
const ACTIVE_GREEN = ONLINE_GREEN;

// Four degrees, and past a week `activityLevel` returns null and the pill does
// not render at all — a live dot over someone last seen months ago is the kind
// of thing a person decides whether to message on. "Today" is a real calendar
// day, so nobody last seen last night is described as having been here today.
const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  online: 'discover.activeNow',
  today: 'discover.activeToday',
  yesterday: 'discover.activeYesterday',
  week: 'discover.activeThisWeek',
};

interface DiscoverProfileCardProps {
  profile: BrowseProfile;
  liked: boolean;
  // Picks the card's colour world — warm on Friends, cool on Rishta.
  mode: ProfileMode;
  onPressPhoto?: (uri: string) => void;
}

// The deck card ("matrimonial dossier"): a photo under a softened Mughal arch
// in a gold hairline frame, with the member's details on a panel that tucks
// under it, so the facts sit on the app's own surface instead of the photo.
export const DiscoverProfileCard = React.memo(function DiscoverProfileCard({
  profile,
  liked,
  mode,
  onPressPhoto,
}: DiscoverProfileCardProps) {
  const { colors, isDark } = useTheme();
  const { t, rtl } = useLanguage();
  const accent = modeAccent(colors, mode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const photosHidden = Boolean(profile.photosBlurred) && !liked;
  const [activeIndex, setActiveIndex] = useState(0);

  const photoCount = profile.photos.length;
  const showPhoto = (index: number) => setActiveIndex(Math.max(0, Math.min(photoCount - 1, index)));

  // A new profile arrives on its first photo, not wherever the last one was left.
  useEffect(() => {
    setActiveIndex(0);
  }, [profile.id]);

  // Distance only appears when the backend actually worked one out.
  const locationLine = [
    profile.distanceKm !== undefined ? t('discover.kmAway', { km: Math.round(profile.distanceKm) }) : null,
    vocabularyLabel(profile.city, t),
    profile.country ? vocabularyLabel(profile.country, t) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const activity = activityLevel(profile.lastActiveAt, profile.isOnline);

  // Two or three glanceable facts, so the card says something meaningful before
  // the member scrolls into the detail sections. Each takes its own accent from
  // the palette below, which is what stops the row reading as grey chips.
  const facts: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [];
  if (profile.intent) facts.push({ icon: 'compass-outline', label: t(`intent.${profile.intent}Title`) });
  if (profile.practising) facts.push({ icon: 'moon-outline', label: t('attributes.practisingYes') });
  if (profile.sect) facts.push({ icon: 'people-circle-outline', label: profile.sect });
  if (profile.occupation) facts.push({ icon: 'briefcase-outline', label: profile.occupation });

  return (
    <View style={styles.shell}>
      {/* Gold hairline frame one layer out from the photo, with the deck's
          own colour thrown softly onto the page beneath it. */}
      <View style={[styles.frameGlow, glow(accent.primary, 0.22, 24, 8)]}>
        <View style={styles.photoFrame}>
          {/* Sized with percentages only, so it renders without waiting on an
              onLayout measurement (which can lag, or never fire, on some platforms). */}
          <SmartImage uri={profile.photos[activeIndex] ?? profile.photos[0]} name={profile.name} style={styles.photo} size={64} />

          {/* Colour wash over the photo's foot, tying it to the panel below. */}
          <LinearGradient
            colors={['transparent', 'rgba(20,11,16,0.15)', withAlpha(accent.primary, 0.45)]}
            style={styles.photoScrim}
            pointerEvents="none"
          />

          {/* Tap zones rather than a nested horizontal pager: paging by drag would
              fight the card's own like/pass swipe. Sides step through the photos,
              the middle opens the full-screen preview. */}
          <View style={styles.tapZones}>
            <Pressable style={styles.tapZoneSide} onPress={() => showPhoto(activeIndex - 1)} />
            <Pressable style={styles.tapZoneCenter} onPress={() => onPressPhoto?.(profile.photos[activeIndex])} />
            <Pressable style={styles.tapZoneSide} onPress={() => showPhoto(activeIndex + 1)} />
          </View>

          {photosHidden && (
            // Android's BlurView renders as a flat, un-blurred tint unless
            // this is set — it defaults to 'none' there, unlike iOS.
            <BlurView
              intensity={45}
              tint={isDark ? 'dark' : 'light'}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <View style={styles.blurCenter}>
                <Ionicons name="lock-closed" size={26} color="#FFFFFF" />
                <Text style={styles.blurText}>{t('profileDetail.photosHidden')}</Text>
              </View>
            </BlurView>
          )}

          {photoCount > 1 && (
            <View style={styles.photoDots} pointerEvents="none">
              {profile.photos.map((_, i) => (
                <View key={i} style={[styles.photoDot, i === activeIndex && styles.photoDotActive]} />
              ))}
            </View>
          )}

          {activity && (
            <View style={styles.activePill} pointerEvents="none">
              {/* The pulsing dot belongs to "now". Keeping it on a week-old
                  badge is what made every card look live. */}
              {activity === 'online' ? <LiveDot /> : <View style={styles.activeDotStill} />}
              <Text style={styles.activeText}>{t(ACTIVITY_LABEL[activity])}</Text>
            </View>
          )}

          {liked && (
            <View style={[styles.likedBadge, glow(colors.dating, 0.8, 12, 6)]} pointerEvents="none">
              <Ionicons name="heart" size={15} color="#FFFFFF" />
            </View>
          )}
        </View>
      </View>

      <View style={styles.identityPanel}>
        {/* Gold flourish: the invitation-card rule above the name. */}
        <View style={styles.flourish}>
          <View style={styles.flourishLine} />
          <View style={styles.flourishDiamond} />
          <View style={styles.flourishLine} />
        </View>

        <View style={[styles.nameRow, rtl && styles.rowRtl]}>
          <Text style={[styles.name, rtl && styles.rtlText]} numberOfLines={1}>
            {profile.name}
          </Text>
          {profile.selfieVerified && (
            <View style={styles.photoRing} accessibilityLabel={t('profile.photoAdded')}>
              <Ionicons name="camera" size={11} color={colors.textInverse} />
            </View>
          )}
        </View>

        {locationLine.length > 0 && (
          <View style={[styles.metaRow, rtl && styles.rowRtl]}>
            <Ionicons name="location" size={12} color={colors.gold} />
            <Text style={[styles.meta, rtl && styles.rtlText]} numberOfLines={1}>
              {locationLine}
            </Text>
          </View>
        )}

        {facts.length > 0 && (
          <View style={[styles.factRow, rtl && styles.rowRtl]}>
            {facts.map((fact) => (
              <View
                key={fact.label}
                style={[
                  styles.fact,
                  { backgroundColor: withAlpha(accent.primary, 0.08), borderColor: withAlpha(accent.primary, 0.22) },
                ]}
              >
                <Ionicons name={fact.icon} size={13} color={colors.gold} />
                <Text style={[styles.factText, { color: accent.primary }]} numberOfLines={1}>
                  {fact.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

// The "active" dot breathes so recency reads as live rather than as one more
// static badge on the photo.
function LiveDot() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.45 }],
    opacity: 0.6 + pulse.value * 0.4,
  }));

  return <Animated.View style={[dotStyles.dot, style]} />;
}

const dotStyles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACTIVE_GREEN },
});

// Softened vaulted crest, per the design system (120px on a phone frame).
const ARCH_RADIUS = scaleSpace(120);

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    shell: { paddingHorizontal: spacing.md },
    // Padding is the mat between the gold hairline and the photo.
    frameGlow: {
      padding: 4,
      borderWidth: 1.5,
      borderColor: withAlpha(colors.gold, 0.8),
      backgroundColor: colors.surface,
      borderTopLeftRadius: ARCH_RADIUS + 5,
      borderTopRightRadius: ARCH_RADIUS + 5,
      borderBottomLeftRadius: radius.lg + 5,
      borderBottomRightRadius: radius.lg + 5,
    },
    // The design system's arch inset: a softened vaulted crest over the photo.
    photoFrame: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderTopLeftRadius: ARCH_RADIUS,
      borderTopRightRadius: ARCH_RADIUS,
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    photo: { width: '100%', height: '100%' },
    photoScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' },
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
    tapZoneSide: { width: '28%', height: '100%' },
    tapZoneCenter: { flex: 1, height: '100%' },
    blurCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
    blurText: { ...typography.body, color: '#FFFFFF', textAlign: 'center' },
    // At the photo's foot, clear of the identity panel that tucks over it and
    // one row above the activity pill: the arch clips the top corners, and the
    // top centre is where the face usually is.
    photoDots: {
      position: 'absolute',
      bottom: spacing.lg + spacing.xl + spacing.xs,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
    photoDotActive: { width: 18, backgroundColor: colors.gold },
    // Top centre, inside the arch's crest.
    // Bottom-left, on the photo's darkened foot and away from the face: a
    // small dark-glass pill rather than a white slab over the portrait.
    activePill: {
      position: 'absolute',
      bottom: spacing.lg + spacing.xs,
      left: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(20,11,16,0.55)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    activeText: { color: '#FFFFFF', fontSize: scaleFont(11), fontFamily: fonts.bodyBold },
    // Same dot, not pulsing: they were here, they are not here now.
    activeDotStill: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACTIVE_GREEN, opacity: 0.55 },
    likedBadge: {
      position: 'absolute',
      bottom: spacing.lg + spacing.xs,
      right: spacing.md,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dating,
    },
    // Tucks under the photo so the two read as one card, without covering the face.
    identityPanel: {
      marginTop: -spacing.lg,
      marginHorizontal: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.md,
      shadowColor: '#2A1720',
      shadowOpacity: 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    flourish: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    flourishLine: { width: scaleSpace(24), height: 1, backgroundColor: colors.gold },
    flourishDiamond: {
      width: scaleSpace(6),
      height: scaleSpace(6),
      backgroundColor: colors.gold,
      transform: [{ rotate: '45deg' }],
    },
    rowRtl: { flexDirection: 'row-reverse' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    name: { ...typography.h1, fontSize: scaleFont(26), lineHeight: scaleFont(32), color: colors.textPrimary, flexShrink: 1 },
    // Says "has a photo", not "verified". A tick in the app's accent beside a
    // name is read as a verified account everywhere else on the internet, and
    // this flag only means a selfie was uploaded at signup.
    photoRing: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: withAlpha(colors.textPrimary, 0.45),
      alignItems: 'center',
      justifyContent: 'center',
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    meta: {
      fontSize: scaleFont(11),
      fontFamily: fonts.bodyBold,
      color: colors.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      flexShrink: 1,
    },
    factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
    fact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: '100%',
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    factText: { ...typography.label, flexShrink: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
