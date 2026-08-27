import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { BrowseProfile } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { activityLevel } from '../../utils/time';

interface DiscoverProfileCardProps {
  profile: BrowseProfile;
  liked: boolean;
  onPressPhoto?: (uri: string) => void;
}

// The deck card: an inset photo frame with the member's details on a panel that
// tucks under it, so the facts sit on the app's own surface instead of being
// burned into the photo with a gradient.
export const DiscoverProfileCard = React.memo(function DiscoverProfileCard({ profile, liked, onPressPhoto }: DiscoverProfileCardProps) {
  const { colors, isDark } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const photosHidden = Boolean(profile.photosBlurred) && !liked;
  const [activeIndex, setActiveIndex] = useState(0);

  const photoCount = profile.photos.length;
  const showPhoto = (index: number) => setActiveIndex(Math.max(0, Math.min(photoCount - 1, index)));

  // Distance only appears when the backend actually worked one out.
  const locationLine = [
    profile.distanceKm !== undefined ? t('discover.kmAway', { km: Math.round(profile.distanceKm) }) : null,
    profile.city,
    profile.country,
  ]
    .filter(Boolean)
    .join(' · ');

  const activity = activityLevel(profile.lastActiveAt);

  // Two or three glanceable facts, so the card says something meaningful before
  // the member scrolls into the detail sections.
  const facts: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [];
  if (profile.intent) facts.push({ icon: 'compass-outline', label: t(`intent.${profile.intent}Title`) });
  if (profile.practising) facts.push({ icon: 'moon-outline', label: t('attributes.practisingYes') });
  if (profile.sect) facts.push({ icon: 'people-circle-outline', label: profile.sect });
  if (profile.occupation) facts.push({ icon: 'briefcase-outline', label: profile.occupation });

  return (
    <View style={styles.shell}>
      <View style={styles.photoFrame}>
        {/* Sized with percentages only, so it renders without waiting on an
            onLayout measurement (which can lag, or never fire, on some platforms). */}
        <Image source={{ uri: profile.photos[activeIndex] ?? profile.photos[0] }} style={styles.photo} />

        {/* Tap zones rather than a nested horizontal pager: paging by drag would
            fight the card's own like/pass swipe. Sides step through the photos,
            the middle opens the full-screen preview. */}
        <View style={styles.tapZones}>
          <Pressable style={styles.tapZoneSide} onPress={() => showPhoto(activeIndex - 1)} />
          <Pressable style={styles.tapZoneCenter} onPress={() => onPressPhoto?.(profile.photos[activeIndex])} />
          <Pressable style={styles.tapZoneSide} onPress={() => showPhoto(activeIndex + 1)} />
        </View>

        {photosHidden && (
          <BlurView intensity={45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="none">
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
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>
              {t(activity === 'today' ? 'discover.activeToday' : 'discover.activeThisWeek')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.identityPanel}>
        <View style={styles.accentBar} />
        <View style={[styles.nameRow, rtl && styles.rowRtl]}>
          <Text style={[styles.name, rtl && styles.rtlText]} numberOfLines={1}>
            {profile.name}, {profile.age}
          </Text>
          {profile.selfieVerified && <Ionicons name="checkmark-circle" size={19} color={colors.teal} />}
        </View>

        {locationLine.length > 0 && (
          <Text style={[styles.meta, rtl && styles.rtlText]} numberOfLines={1}>
            {locationLine}
          </Text>
        )}

        {facts.length > 0 && (
          <View style={[styles.factRow, rtl && styles.rowRtl]}>
            {facts.map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <Ionicons name={fact.icon} size={13} color={colors.textSecondary} />
                <Text style={styles.factText} numberOfLines={1}>
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    shell: { paddingHorizontal: spacing.md },
    photoFrame: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    photo: { width: '100%', height: '100%' },
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
    tapZoneSide: { width: '28%', height: '100%' },
    tapZoneCenter: { flex: 1, height: '100%' },
    blurCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
    blurText: { ...typography.body, color: '#FFFFFF', textAlign: 'center' },
    photoDots: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      right: spacing.sm,
      flexDirection: 'row',
      gap: 4,
    },
    photoDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
    photoDotActive: { backgroundColor: 'rgba(255,255,255,0.95)' },
    activePill: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 6,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACTIVE_GREEN },
    activeText: { color: colors.textPrimary, fontSize: scaleFont(12), fontWeight: '700' },
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
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    accentBar: {
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.gold,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { ...typography.h2, color: colors.textPrimary, flexShrink: 1 },
    meta: {
      color: colors.textSecondary,
      fontSize: scaleFont(11),
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
    fact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: '100%',
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    factText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600', flexShrink: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });

// Reads the same in both themes, so it isn't a palette token.
const ACTIVE_GREEN = '#22C55E';
