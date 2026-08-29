import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TAB_BAR_BASE_HEIGHT, useHideTabBarOnScroll } from '../../store/TabBarVisibilityContext';
import { MatchRow } from '../../components/matches/MatchRow';
import { ModeToggle } from '../../components/profile/ModeToggle';
import { FadeIn } from '../../components/common/FadeInUp';
import { useAuth } from '../../store/AuthContext';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useMatches } from '../../store/MatchesContext';
import type { Match } from '../../types/content';
import type { ProfileMode } from '../../types/user';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

// An accepted Move to Rishta is what decides the side a thread sits on. The flag
// is the source of truth rather than `mode` alone, so threads moved before the
// mode field started being flipped still land under Rishta.
function threadMode(match: Match): ProfileMode {
  return match.movedToRishta ? 'rishta' : match.mode;
}

export function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, setActiveMode } = useAuth();
  const { matches } = useMatches();
  const insets = useSafeAreaInsets();
  const onScroll = useHideTabBarOnScroll();

  // Threads live in the same two modes as the decks: a match stays in Friends
  // until both sides accept a Move to Rishta, which flips it over to Rishta.
  const mode: ProfileMode = user?.activeMode ?? 'dating';
  const friendsMatches = useMemo(() => matches.filter((m) => threadMode(m) === 'dating'), [matches]);
  const rishtaMatches = useMemo(() => matches.filter((m) => threadMode(m) === 'rishta'), [matches]);
  const visibleMatches = mode === 'dating' ? friendsMatches : rishtaMatches;

  const otherMode: ProfileMode = mode === 'dating' ? 'rishta' : 'dating';
  const otherCount = otherMode === 'dating' ? friendsMatches.length : rishtaMatches.length;
  const otherModeLabel = t(otherMode === 'dating' ? 'profile.datingMode' : 'profile.rishtaMode');

  return (
    <ScreenContainer scroll={false} edges={['top']}>
      <FadeIn><Text style={[styles.title, rtl && styles.rtlText]}>{t('matches.title')}</Text></FadeIn>

      <View style={styles.toggleWrap}>
        <ModeToggle
          mode={mode}
          onChange={setActiveMode}
          datingLabel={t('profile.datingMode')}
          rishtaLabel={t('profile.rishtaMode')}
          datingCount={friendsMatches.length}
          rishtaCount={rishtaMatches.length}
        />
      </View>

      <FlatList
        data={visibleMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)}>
            <MatchRow match={item} onPress={() => router.push(`/chat/${item.id}`)} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.lg }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>
              {t(mode === 'dating' ? 'matches.emptyFriends' : 'matches.emptyRishta')}
            </Text>
            {/* Filtering by mode can otherwise read as "my chats disappeared", so
                the other side's tally is spelled out with a way to get there. */}
            {otherCount > 0 && (
              <>
                <Text style={[styles.emptyHint, rtl && styles.rtlText]}>
                  {t('matches.otherModeHint', { count: otherCount, mode: otherModeLabel })}
                </Text>
                <Pressable onPress={() => setActiveMode(otherMode)} style={styles.switchButton}>
                  <Text style={styles.switchLabel}>{t('matches.switchTo', { mode: otherModeLabel })}</Text>
                </Pressable>
              </>
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.md },
    toggleWrap: { paddingBottom: spacing.md },
    separator: { height: 1, backgroundColor: colors.borderSoft },
    listContent: { paddingBottom: spacing.xl },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    emptyHint: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: spacing.xl },
    switchButton: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.rishta,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    switchLabel: { ...typography.label, color: colors.rishta, fontWeight: '700' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
