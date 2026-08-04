import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { DiscoverProfile } from '../../types/content';
import { Chip } from '../common/Chip';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface DiscoverListCardProps {
  profile: DiscoverProfile;
  liked: boolean;
  onPress: () => void;
  onToggleLike: () => void;
}

export const DiscoverListCard = React.memo(function DiscoverListCard({ profile, liked, onPress, onToggleLike }: DiscoverListCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { rtl } = useLanguage();
  const heartScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const onLikePress = () => {
    heartScale.value = withSpring(1.35, { damping: 6, stiffness: 260 }, () => {
      heartScale.value = withSpring(1, { damping: 10, stiffness: 220 });
    });
    onToggleLike();
  };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.photoWrap}>
        <Image source={{ uri: profile.photos[0] }} style={styles.photo} />
        {profile.photos.length > 1 && (
          <View style={styles.photoCountBadge}>
            <Ionicons name="images" size={11} color="#FFFFFF" />
            <Text style={styles.photoCountText}>{profile.photos.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, rtl && styles.rtlText]}>
          {profile.name}, {profile.age}
        </Text>
        <View style={styles.cityRow}>
          <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.meta, rtl && styles.rtlText]}>{profile.city}</Text>
        </View>
        <Text style={[styles.bio, rtl && styles.rtlText]} numberOfLines={2}>{profile.bio}</Text>
        <View style={styles.tagRow}>
          {profile.vibeTags.slice(0, 2).map((tag) => (
            <Chip key={tag} label={tag} tone="dating" />
          ))}
        </View>
      </View>

      <Pressable onPress={onLikePress} hitSlop={8} style={styles.likeButton}>
        <Animated.View style={heartStyle}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.dating : colors.textTertiary} />
        </Animated.View>
      </Pressable>
    </Pressable>
  );
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    cardPressed: { opacity: 0.85 },
    photoWrap: { position: 'relative' },
    photo: { width: 84, height: 104, borderRadius: radius.md, backgroundColor: colors.skeleton },
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
    photoCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
    body: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
    name: { ...typography.h3, color: colors.textPrimary },
    cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    meta: { ...typography.caption, color: colors.textSecondary },
    bio: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
    likeButton: { padding: spacing.xs, marginLeft: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
