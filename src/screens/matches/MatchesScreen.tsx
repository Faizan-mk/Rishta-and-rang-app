import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TAB_BAR_BASE_HEIGHT } from '../../store/TabBarVisibilityContext';
import { MatchRow } from '../../components/matches/MatchRow';
import { HomeStoriesRow, type StoryConnection } from '../../components/discover/HomeStoriesRow';
import { AccentHeading } from '../../components/common/AccentHeading';
import { AuroraBackground } from '../../components/common/AuroraBackground';
import { EmptyOrb } from '../../components/common/EmptyOrb';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useMatches } from '../../store/MatchesContext';
import { useStories } from '../../store/StoriesContext';
import { useAuth } from '../../store/AuthContext';
import { useAddStory } from '../../hooks/useAddStory';
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleSpace } from '../../theme/responsive';
import { APP_MODE, glow, modeAccent } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

export function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { matches, blockedProfiles } = useMatches();
  const { mine: myStories, others: storyGroups } = useStories();
  const { addStory, posting: postingStory } = useAddStory();
  const [filter, setFilter] = useState<'all' | 'unread' | 'friends' | 'rishta'>('all');
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
  const visibleMatches = matches.filter((m) => {
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

  // The status strip across the top, WhatsApp-style: the member's own story,
  // then connections with a story up, then the rest of their connections.
  const storyConnections = useMemo<StoryConnection[]>(() => {
    const blocked = new Set(blockedProfiles.map((b) => b.id));
    const withStory = new Set(storyGroups.map((g) => g.userId));
    return matches
      .filter((m) => !m.sourceProfileId || (!blocked.has(m.sourceProfileId) && !withStory.has(m.sourceProfileId)))
      .map((m) => ({ matchId: m.id, name: m.name, photo: m.photo }));
  }, [matches, storyGroups, blockedProfiles]);

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: t('matches.filterAll') },
    { key: 'unread', label: unreadCount > 0 ? `${t('matches.filterUnread')} ${unreadCount}` : t('matches.filterUnread') },
    { key: 'friends', label: t('profile.datingMode') },
    { key: 'rishta', label: t('profile.rishtaMode') },
  ];

  const listHeader = (
    <View>
      {/* Full-bleed, past the screen's side padding, so the strip scrolls edge
          to edge. */}
      <View style={styles.storiesBleed}>
        <HomeStoriesRow
          myPhoto={user?.photos[0]}
          hasMyStory={Boolean(myStories)}
          posting={postingStory}
          onPressMine={() => user && router.push({ pathname: '/story/[userId]', params: { userId: user.id } })}
          onAddStory={addStory}
          groups={storyGroups}
          onPressGroup={(id) => router.push({ pathname: '/story/[userId]', params: { userId: id } })}
          connections={storyConnections}
          onPressConnection={(matchId) => router.push(`/chat/${matchId}`)}
          suggestions={[]}
          onPressSuggestion={() => undefined}
        />
      </View>

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

      <FadeIn>
        <AccentHeading
          size="screen"
          title={t('matches.title')}
          gradient={accent.ramp}
          style={styles.heading}
          right={
            unreadCount > 0 ? (
              <LinearGradient
                colors={accent.duo}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.unreadPill, glow(accent.primary, 0.55, 12, 5)]}
              >
                <View style={styles.unreadDot} />
                <Text style={styles.unreadPillText}>{unreadCount}</Text>
              </LinearGradient>
            ) : undefined
          }
        />
      </FadeIn>

      <FlatList
        style={styles.list}
        data={visibleMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)}>
            <MatchRow
              match={item}
              onPress={() => router.push(`/chat/${item.id}`)}
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
              {filter === 'unread'
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
    heading: { marginBottom: spacing.md },
    unreadPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
    unreadPillText: { ...typography.caption, color: '#FFFFFF', fontFamily: fonts.bodyBold },
    storiesBleed: { marginHorizontal: -spacing.lg },
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
