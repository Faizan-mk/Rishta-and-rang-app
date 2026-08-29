import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ProfileCard } from '../../components/ProfileCard';
import { useFavorites, FavoriteProfile } from '../../store/FavoritesContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

export function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { favorites, removeFavorite } = useFavorites();

  const renderItem = ({ item, index }: { item: FavoriteProfile; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(360)}>
      <ProfileCard
        photo={item.photo}
        name={item.name}
        age={item.age}
        city={item.city}
        kind={item.kind}
        onPress={() => router.push({ pathname: '/profile-detail', params: { kind: item.kind, id: item.id } })}
        action={
          <Pressable onPress={() => removeFavorite(item.id)} hitSlop={8} style={styles.removeButton}>
            <Ionicons name="heart" size={20} color={colors.dating} />
          </Pressable>
        }
      />
    </Animated.View>
  );

  return (
    <ScreenContainer scroll={false}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('favorites.empty')}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    removeButton: { padding: spacing.xs },
    listContent: { paddingBottom: spacing.xl },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
