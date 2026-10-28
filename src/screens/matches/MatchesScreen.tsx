import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TAB_BAR_BASE_HEIGHT } from '../../store/TabBarVisibilityContext';
import { MatchRow } from '../../components/matches/MatchRow';
import { AuroraBackground } from '../../components/common/AuroraBackground';
import { EmptyOrb } from '../../components/common/EmptyOrb';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useMatches } from '../../store/MatchesContext';
import { useStories } from '../../store/StoriesContext';
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleSpace } from '../../theme/responsive';
import { APP_MODE, modeAccent } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { matches } = useMatches();
  const { others: storyGroups } = useStories();
  const [filter, setFilter] = useState<'all' | 'unread' | 'friends' | 'rishta'>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = () => {
    setQuery('');
    setSearchOpen(false);
  };
  const insets = useSafeAreaInsets();

  const accent = modeAccent(colors, APP_MODE);
  // Every thread, Friends and Rishta alike, in one list; a moved thread
  // carries a "Rishta" badge (see MatchRow).
  // Blocking keeps the thread (supabase/35_block_keeps_thread.sql) and keeps
  // it right here too, rather than stepping it out of the list Ã¢â‚¬â€ the chat
  // itself is what shows the blocked state and the way to undo it.
  // An accepted Move to Rishta is what puts a thread on the Rishta side; the
  // flag is checked as well as `mode` so threads moved before the mode started
  // being flipped still count.
  const isRishta = (m: (typeof matches)[number]) => m.movedToRishta || m.mode === 'rishta';
  // The search bar narrows by name on top of whichever filter chip is lit.
  const needle = query.trim().toLowerCase();
  const visibleMatches = matches.filter((m) => {
    if (needle && !m.name.toLowerCase().includes(needle)) return false;
    if (filter === 'unread') return m.unread;
    if (filter === 'friends') return !isRishta(m);
    if (filter === 'rishta') return isRishta(m);
    return true;
  });
  // Whose stories are up, by user id, so each row can show a story ring.
  const storyByUser = useMemo(
    () => new Map(storyGroups.map((g) => [g.userId, g.allSeen ? ('seen' as const) : ('unseen' as const)])),
    [storyGroups]
  );
  const unreadCount = matches.filter((m) => m.unread).length;

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: t('matches.filterAll') },
    { key: 'unread', label: unreadCount > 0 ? `${t('matches.filterUnread')} ${unreadCount}` : t('matches.filterUnread') },
    { key: 'friends', label: t('profile.datingMode') },
    { key: 'rishta', label: t('profile.rishtaMode') },
  ];

  const listHeader = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={[styles.chips, rtl && styles.chipsRtl]}
      >
        {filters.map((f) => {
          const selected = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && { backgroundColor: accent.primary, borderColor: accent.primary }]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <ScreenContainer scroll={false} edges={['top']}>
      <AuroraBackground colors={colors} mode={APP_MODE} bleed={spacing.lg} />

      {/* A slim title with a search icon, WhatsApp-style; the icon swaps the
          row for the search field. Both are the same height, so opening search
          doesn't shift the list. Outside the list, so it stays put while the
          chats scroll under it. */}
      {searchOpen ? (
        <View style={[styles.topRow, styles.searchBar, rtl && styles.rowRtl]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('matches.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, rtl && styles.rtlText]}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus
            maxLength={60}
          />
          <Pressable onPress={closeSearch} hitSlop={8} accessibilityLabel={t('matches.searchClear')}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.topRow, rtl && styles.rowRtl]}>
          <Text style={[styles.topTitle, rtl && styles.rtlText]} numberOfLines={1}>
            {t('matches.title')}
          </Text>
          <Pressable
            onPress={() => setSearchOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('matches.searchPlaceholder')}
            style={styles.searchButton}
          >
            <Ionicons name="search" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      )}

      <FlatList
        style={styles.list}
        data={visibleMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)}>
            <MatchRow
              match={item}
              onPress={() => router.push(`/chat/${item.id}`)}
              onPressAvatar={() =>
                item.sourceProfileId
                  ? router.push({
                      pathname: '/profile-detail',
                      params: { kind: item.movedToRishta ? 'rishta' : item.mode, id: item.sourceProfileId },
                    })
                  : router.push(`/chat/${item.id}`)
              }
              story={item.sourceProfileId ? storyByUser.get(item.sourceProfileId) : undefined}
              onPressStory={() =>
                item.sourceProfileId &&
                router.push({ pathname: '/story/[userId]', params: { userId: item.sourceProfileId } })
              }
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={[styles.separator, rtl && styles.separatorRtl]} />}
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + spacing.lg }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
              <EmptyOrb ramp={accent.ramp} icon="chatbubble-ellipses-outline" />
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>
              {needle
                ? t('matches.searchEmpty', { query: query.trim() })
                : filter === 'unread'
                ? t('matches.noUnread')
                : filter === 'friends'
                  ? t('matches.noFriends')
                  : filter === 'rishta'
                    ? t('matches.noRishta')
                    : t('matches.empty')}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Pulled up into the container's top padding so the title sits where Home's
    // top bar puts its own, not a row lower than every other tab.
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 44,
      marginTop: -spacing.md,
      marginBottom: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    topTitle: { ...typography.h2, color: colors.textPrimary, flex: 1 },
    searchButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchBar: {
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.sm },
    // Bleeds to the screen edges like the story strip, so a fifth chip on a
    // narrow phone scrolls instead of wrapping.
    chipsScroll: { flexGrow: 0, marginHorizontal: -spacing.lg, marginBottom: spacing.sm },
    chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
    chipsRtl: { flexDirection: 'row-reverse' },
    chip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    chipLabel: { ...typography.label, color: colors.textSecondary, fontFamily: fonts.bodyBold },
    chipLabelSelected: { color: '#FFFFFF' },
    // A plain list, WhatsApp-style: no card around it, just hairlines between
    // rows, inset past the avatar.
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: scaleSpace(56) + spacing.md + spacing.sm,
      marginRight: spacing.sm,
    },
    separatorRtl: { marginLeft: spacing.sm, marginRight: scaleSpace(56) + spacing.md + spacing.sm },
    // The list spans the full screen width and puts the screen's side padding
    // back inside, so the story strip and chips can reach the edges without
    // being clipped by the list's own bounds.
    list: { marginHorizontal: -spacing.lg },
    listContent: { paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
