import React, { useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { BrowseProfile } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface DiscoverProfileCardProps {
  profile: BrowseProfile;
  liked: boolean;
  onPressPhoto?: (uri: string) => void;
}

export const DiscoverProfileCard = React.memo(function DiscoverProfileCard({ profile, liked, onPressPhoto }: DiscoverProfileCardProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const photosHidden = Boolean(profile.photosBlurred) && !liked;
  const [galleryWidth, setGalleryWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setGalleryWidth(e.nativeEvent.layout.width);
  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (galleryWidth === 0) return;
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / galleryWidth));
  };

  return (
    <View style={styles.card} onLayout={onLayout}>
      {/* Base photo — sized purely with CSS percentages so it renders immediately,
          with no dependency on onLayout measurement (which can lag or never fire
          on some platforms, leaving the card blank). The pager below, which does
          need a measured pixel width to page correctly, layers on top of it once
          ready and only when there's more than one photo to swipe between. */}
      <Image source={{ uri: profile.photos[0] }} style={styles.photo} />

      {profile.photos.length > 1 && galleryWidth > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onGalleryScroll}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
        >
          {profile.photos.map((uri) => (
            <Pressable key={uri} onPress={() => onPressPhoto?.(uri)} style={{ width: galleryWidth }}>
              <Image source={{ uri }} style={styles.photo} />
            </Pressable>
          ))}
        </ScrollView>
      )}
      {profile.photos.length === 1 && (
        <Pressable onPress={() => onPressPhoto?.(profile.photos[0])} style={StyleSheet.absoluteFill} />
      )}

      {photosHidden && (
        <BlurView intensity={45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.blurCenter}>
            <Ionicons name="lock-closed" size={26} color="#FFFFFF" />
            <Text style={styles.blurText}>{t('profileDetail.photosHidden')}</Text>
          </View>
        </BlurView>
      )}

      {profile.photos.length > 1 && (
        <View style={styles.photoDots} pointerEvents="none">
          {profile.photos.map((_, i) => (
            <View key={i} style={[styles.photoDot, i === activeIndex && styles.photoDotActive]} />
          ))}
        </View>
      )}

      {profile.bureauVerified && (
        <View style={styles.verifiedBadge} pointerEvents="none">
          <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
          <Text style={styles.verifiedBadgeText}>{t('profile.verified')}</Text>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(10,10,12,0.88)']}
        locations={[0.35, 1]}
        style={styles.gradient}
        pointerEvents="none"
      >
        <Text style={styles.name} numberOfLines={1}>
          {profile.name}, {profile.age}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.meta}>{profile.city}</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      width: '100%',
      aspectRatio: 3 / 4,
      backgroundColor: colors.skeleton,
    },
    photo: { width: '100%', height: '100%' },
    blurCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
    blurText: { ...typography.body, color: '#FFFFFF', textAlign: 'center' },
    photoDots: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      gap: 4,
    },
    photoDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
    photoDotActive: { backgroundColor: 'rgba(255,255,255,0.95)' },
    verifiedBadge: {
      position: 'absolute',
      top: spacing.lg,
      left: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(10,10,12,0.55)',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    verifiedBadgeText: { color: '#FFFFFF', fontSize: scaleFont(11), fontWeight: '700' },
    gradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.xxl,
    },
    name: { ...typography.h1, color: '#FFFFFF' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    meta: { ...typography.body, color: 'rgba(255,255,255,0.9)' },
  });
