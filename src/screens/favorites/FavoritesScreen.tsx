import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ProfileCard } from '../../components/ProfileCard';
import { useFavorites, FavoriteProfile } from '../../store/FavoritesContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { favorites, removeFavorite } = useFavorites();
  const { user } = useAuth();
  const accent = modeAccent(colors, user?.activeMode ?? 'dating');

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
      <AccentHeading
        size="screen"
        title={t('profile.favorites')}
        gradient={accent.ramp}
        style={styles.heading}
      />

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={accent.ramp}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.emptyOrb, glow(accent.primary, 0.5, 22, 10)]}
            >
              <Ionicons name="heart" size={30} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('favorites.empty')}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    heading: { marginBottom: spacing.md },
    removeButton: {
      padding: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.dating, 0.12),
    },
    listContent: { paddingBottom: spacing.xl },
    emptyOrb: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
