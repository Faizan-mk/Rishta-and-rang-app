import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { RishtaListingProfile } from '../../types/content';
import { Badge } from '../common/Badge';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { vocabularyLabel } from '../../i18n/vocabulary';

const READINESS_KEY: Record<string, string> = {
  browsing: 'profile.readinessBrowsing',
  few_months: 'profile.readinessFewMonths',
  ready_now: 'profile.readinessNow',
};

interface RishtaListingCardProps {
  profile: RishtaListingProfile;
  liked?: boolean;
  onPress: () => void;
  onToggleLike?: () => void;
}

export const RishtaListingCard = React.memo(function RishtaListingCard({ profile, liked, onPress, onToggleLike }: RishtaListingCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const photosHidden = Boolean(profile.photosBlurred) && !liked;
  const accent = modeAccent(colors, 'rishta');

  const onLikePress = () => {
    heartScale.value = withSpring(1.35, { damping: 6, stiffness: 260 }, () => {
      heartScale.value = withSpring(1, { damping: 10, stiffness: 220 });
    });
    onToggleLike?.();
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, glow(accent.primary, 0.2, 14, 5), pressed && styles.cardPressed]}
    >
      <LinearGradient
        colors={accent.ramp}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoWrap}
      >
        <Image source={{ uri: profile.photos[0] }} style={styles.photo} />
        {photosHidden ? (
          <BlurView intensity={35} tint={isDark ? 'dark' : 'light'} style={styles.blurOverlay}>
            <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
          </BlurView>
        ) : (
          profile.photos.length > 1 && (
            <View style={styles.photoCountBadge}>
              <Ionicons name="images" size={11} color="#FFFFFF" />
              <Text style={styles.photoCountText}>{profile.photos.length}</Text>
            </View>
          )
        )}
      </LinearGradient>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, rtl && styles.rtlText]}>
            {profile.name}, {profile.age}
          </Text>
          {profile.readiness === 'ready_now' && <Badge label={t(READINESS_KEY[profile.readiness])} tone="rishta" />}
        </View>
        <Text style={[styles.meta, rtl && styles.rtlText]}>{vocabularyLabel(profile.city, t)} · {vocabularyLabel(profile.sect, t)}</Text>
        <Text style={[styles.meta, rtl && styles.rtlText]} numberOfLines={1}>{profile.education}</Text>
        <Text style={[styles.family, rtl && styles.rtlText]} numberOfLines={2}>{profile.familyBackground}</Text>
        {profile.readiness !== 'ready_now' && (
          <View style={styles.readinessRow}>
            <Badge label={t(READINESS_KEY[profile.readiness])} tone="neutral" />
          </View>
        )}
      </View>
      {onToggleLike && (
        <Pressable onPress={onLikePress} hitSlop={8} style={styles.likeButton}>
          <Animated.View style={heartStyle}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={21} color={liked ? colors.rishta : colors.textTertiary} />
          </Animated.View>
        </Pressable>
      )}
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} style={styles.chevron} />
    </Pressable>
  );
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    cardPressed: { opacity: 0.85 },
    photoWrap: { position: 'relative', width: 88, height: 108, borderRadius: radius.md + 2, padding: 2 },
    photo: { width: '100%', height: '100%', borderRadius: radius.md, backgroundColor: colors.skeleton },
    blurOverlay: {
      position: 'absolute',
      top: 2,
      left: 2,
      right: 2,
      bottom: 2,
      borderRadius: radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoCountBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.overlay,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    photoCountText: { color: '#FFFFFF', fontSize: scaleFont(10), fontWeight: '700' },
    body: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    name: { ...typography.h3, color: colors.textPrimary, fontWeight: '800' },
    meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    family: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    readinessRow: { marginTop: spacing.xs },
    likeButton: {
      padding: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.rishta, 0.1),
    },
    chevron: { marginLeft: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
