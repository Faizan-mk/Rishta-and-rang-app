import React, { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { AppStackScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Badge } from '../../components/common/Badge';
import { useFavorites, FavoriteProfile } from '../../store/FavoritesContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'Favorites'>;

export function FavoritesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { favorites, removeFavorite } = useFavorites();

  const renderItem = ({ item, index }: { item: FavoriteProfile; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(360)}>
      <Pressable
        onPress={() => navigation.navigate('ProfileDetail', { kind: item.kind, id: item.id })}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <Image source={{ uri: item.photo }} style={styles.photo} />
        <View style={styles.body}>
          <Text style={[styles.name, rtl && styles.rtlText]}>
            {item.name}, {item.age}
          </Text>
          <Text style={[styles.meta, rtl && styles.rtlText]}>{item.city}</Text>
          {/* Same two labels the Home and Matches toggles use, so a saved
              profile reads as the same mode everywhere. */}
          <Badge
            label={t(item.kind === 'dating' ? 'profile.datingMode' : 'profile.rishtaMode')}
            tone={item.kind === 'dating' ? 'dating' : 'rishta'}
          />
        </View>
        <Pressable onPress={() => removeFavorite(item.id)} hitSlop={8} style={styles.removeButton}>
          <Ionicons name="heart" size={20} color={colors.dating} />
        </Pressable>
      </Pressable>
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
    photo: { width: 64, height: 80, borderRadius: radius.md, backgroundColor: colors.skeleton },
    body: { flex: 1, marginLeft: spacing.md, gap: 4 },
    name: { ...typography.h3, color: colors.textPrimary },
    meta: { ...typography.caption, color: colors.textSecondary },
    removeButton: { padding: spacing.xs },
    listContent: { paddingBottom: spacing.xl },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
