import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { MainTabScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { DiscoverListCard } from '../../components/discover/DiscoverListCard';
import { MatchCelebration } from '../../components/discover/MatchCelebration';
import { mockDiscoverProfiles } from '../../data/mockDiscover';
import type { DiscoverProfile } from '../../types/content';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useFavorites } from '../../store/FavoritesContext';
import { useDialog } from '../../store/DialogContext';
import { useLikeLimit } from '../../store/LikeLimitContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = MainTabScreenProps<'Discover'>;

export function DiscoverScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { confirm } = useDialog();
  const { isUnlimited, remaining, recordLike } = useLikeLimit();
  const [celebration, setCelebration] = useState<{ name: string; photo: string } | null>(null);

  const visibleProfiles = useMemo(
    () => oppositeGenderProfiles(mockDiscoverProfiles, user?.gender),
    [user?.gender]
  );

  const toggleLike = async (profile: DiscoverProfile) => {
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
        }
        return;
      }
    }
    toggleFavorite({ id: profile.id, kind: 'dating', name: profile.name, age: profile.age, city: profile.city, photo: profile.photos[0] });
    if (!wasLiked) {
      setCelebration({ name: profile.name, photo: profile.photos[0] });
    }
  };

  const renderItem = ({ item, index }: { item: DiscoverProfile; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(360)}>
      <DiscoverListCard
        profile={item}
        liked={isFavorite(item.id)}
        onPress={() => navigation.navigate('ProfileDetail', { kind: 'dating', id: item.id })}
        onToggleLike={() => toggleLike(item)}
      />
    </Animated.View>
  );

  return (
    <ScreenContainer scroll={false} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('discover.title')}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.modeBadge}>
            <Ionicons name="flame" size={12} color={colors.dating} />
            <Text style={styles.modeBadgeText}>{t('discover.subtitle')}</Text>
          </View>
          {!isUnlimited && (
            <View style={styles.likesBadge}>
              <Ionicons name="heart" size={12} color={colors.teal} />
              <Text style={styles.likesBadgeText}>{t('discover.likesRemaining', { count: remaining })}</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={visibleProfiles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('discover.empty')}</Text>
          </View>
        }
      />

      <MatchCelebration
        visible={Boolean(celebration)}
        name={celebration?.name ?? ''}
        photo={celebration?.photo ?? ''}
        onClose={() => setCelebration(null)}
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { ...typography.h1, color: colors.textPrimary },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    modeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.datingSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    modeBadgeText: { ...typography.caption, color: colors.dating, fontWeight: '700' },
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
    listContent: { paddingBottom: spacing.xl },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
