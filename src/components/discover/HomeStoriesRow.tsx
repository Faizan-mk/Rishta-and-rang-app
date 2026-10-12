import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { APP_MODE, modeAccent } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import type { StoryGroup } from '../../types/content';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface HomeStoriesRowProps {
  myPhoto?: string;
  // Whether the member has a story up right now; their circle then opens it.
  hasMyStory: boolean;
  // Shows a spinner on the member's circle while a new story uploads.
  posting: boolean;
  onPressMine: () => void;
  onAddStory: () => void;
  // Connections' stories, already in strip order.
  groups: StoryGroup[];
  onPressGroup: (userId: string) => void;
  // The rest of the member's connections, who have no story up. They follow
  // the story circles without a ring; tapping one opens the chat.
  connections: StoryConnection[];
  onPressConnection: (matchId: string) => void;
  // People from the deck the member is not connected with yet, so the strip
  // is never just one or two circles. Tapping one opens their profile.
  suggestions: StorySuggestion[];
  onPressSuggestion: (suggestion: StorySuggestion) => void;
}

export interface StorySuggestion {
  id: string;
  name: string;
  photo: string;
  kind: 'dating' | 'rishta';
}

export interface StoryConnection {
  matchId: string;
  name: string;
  photo: string;
}

const AVATAR = 60;
const RING = 2;
const GAP = 2;
const OUTER = AVATAR + (RING + GAP) * 2;

// Story strip under the Home header, Instagram-style: the member's own circle
// first with a "+" to add, then each connection with a story up (a lit ring
// means something unseen, grey means all seen), then the rest of their
// connections without a ring, then people from the deck to fill it out.
export function HomeStoriesRow({
  myPhoto,
  hasMyStory,
  posting,
  onPressMine,
  onAddStory,
  groups,
  onPressGroup,
  connections,
  onPressConnection,
  suggestions,
  onPressSuggestion,
}: HomeStoriesRowProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const accent = modeAccent(colors, APP_MODE);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[styles.row, rtl && styles.rowRtl]}
      >
        <View style={styles.item}>
          <Pressable
            onPress={hasMyStory ? onPressMine : onAddStory}
            accessibilityRole="button"
            accessibilityLabel={t('discover.myStory')}
            style={[styles.ring, { borderColor: hasMyStory ? accent.primary : colors.border }]}
          >
            {myPhoto ? (
              <Image source={{ uri: myPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Ionicons name="person" size={26} color={colors.textTertiary} />
              </View>
            )}
            {posting && (
              <View style={styles.postingVeil}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={onAddStory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('stories.add')}
            style={[styles.addBadge, { backgroundColor: accent.primary }]}
          >
            <Ionicons name="add" size={14} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.name} numberOfLines={1}>
            {t('discover.myStory')}
          </Text>
        </View>

        {groups.map((group) => (
          <Pressable key={group.userId} onPress={() => onPressGroup(group.userId)} style={styles.item}>
            <View style={[styles.ring, { borderColor: group.allSeen ? colors.border : accent.primary }]}>
              <Image source={{ uri: group.photo }} style={styles.avatar} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {group.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}

        {connections.map((person) => (
          <Pressable key={person.matchId} onPress={() => onPressConnection(person.matchId)} style={styles.item}>
            <View style={[styles.ring, styles.noRing]}>
              <Image source={{ uri: person.photo }} style={styles.avatar} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {person.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}

        {suggestions.map((person) => (
          <Pressable key={person.id} onPress={() => onPressSuggestion(person)} style={styles.item}>
            <View style={[styles.ring, styles.noRing]}>
              <Image source={{ uri: person.photo }} style={styles.avatar} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {person.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // A ScrollView grows to fill its parent by default, which pushed the deck
    // card to the bottom of the screen. Android ignores flexGrow on a
    // horizontal one, so a plain wrapper View holds the strip to its circles'
    // height.
    wrap: { flexGrow: 0, flexShrink: 0 },
    scroll: { flexGrow: 0 },
    row: { gap: spacing.sm + 4, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    rowRtl: { flexDirection: 'row-reverse' },
    item: { width: OUTER, alignItems: 'center', gap: 4 },
    ring: {
      width: OUTER,
      height: OUTER,
      borderRadius: OUTER / 2,
      borderWidth: RING,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noRing: { borderColor: 'transparent' },
    avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.skeleton },
    avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
    postingVeil: {
      ...StyleSheet.absoluteFillObject,
      margin: RING + GAP,
      borderRadius: AVATAR / 2,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBadge: {
      position: 'absolute',
      top: OUTER - 22,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    name: {
      ...typography.caption,
      fontSize: scaleFont(11),
      fontFamily: fonts.bodyBold,
      color: colors.textSecondary,
      maxWidth: OUTER,
    },
  });
