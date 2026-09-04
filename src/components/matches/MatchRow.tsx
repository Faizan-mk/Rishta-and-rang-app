import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Match } from '../../types/content';
import { Badge } from '../common/Badge';
import { radius, spacing, typography } from '../../theme';
import { scaleFont, scaleSpace } from '../../theme/responsive';
// `glow` still lights the unread dot — a 10pt circle, where the halo is the
// point. It is the card-sized one that had to go.
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { timeAgo } from '../../utils/time';
import { previewLabel } from '../../utils/messagePreview';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

// The avatar scales with the device like the rest of the theme does, so the row
// keeps its proportions on a small phone and on a tablet rather than pinning a
// 56pt circle beside text that grew around it.
const AVATAR = scaleSpace(56);
const RING_PADDING = 2;

// A thread card rather than a flat list line: the avatar sits in a gradient ring
// in the thread's own mode colour, and an unread thread lifts on a glowing dot
// so the list can be read at a glance.
export const MatchRow = React.memo(function MatchRow({ match, onPress }: { match: Match; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  // Same rule the Messages list sorts by — an accepted Move to Rishta decides
  // which world the thread belongs to, and so which colours it wears.
  const accent = modeAccent(colors, match.movedToRishta ? 'rishta' : match.mode);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        rtl && styles.rowRtl,
        // Unread is a tint and an accent-tinted edge, not a lifted card. It used
        // to carry a coloured `glow`, whose `elevation` Android draws as a wide
        // shadow well outside the 14pt corner — which read as a second card
        // sitting behind the first rather than as a highlight.
        match.unread && [styles.rowUnread, { borderColor: withAlpha(accent.primary, 0.45) }],
      ]}
    >
      <LinearGradient colors={accent.ramp} start={GRADIENT_START} end={GRADIENT_END} style={styles.avatarRing}>
        <Image source={{ uri: match.photo }} style={styles.avatar} />
      </LinearGradient>

      <View style={styles.textWrap}>
        <View style={[styles.nameRow, rtl && styles.rowRtl]}>
          <Text style={[styles.name, match.unread && styles.nameUnread, rtl && styles.rtlText]} numberOfLines={1}>
            {match.name}
          </Text>
          {/* Short, because this column is what is left of the row after an
              avatar and the timestamp: the full "Moved to Rishta" took most of
              it and left the name a few characters. The stage is the fact worth
              showing here; the chat header says it the same way. */}
          {match.movedToRishta && (
            <View style={styles.badgeWrap}>
              <Badge label={t('matches.rishtaBadge')} tone="rishta" />
            </View>
          )}
        </View>
        <Text
          style={[styles.message, match.unread && { color: colors.textPrimary }, rtl && styles.rtlText]}
          numberOfLines={1}
        >
          {previewLabel(match.lastMessage, t)}
        </Text>
      </View>

      <View style={styles.metaWrap}>
        <Text style={styles.time} numberOfLines={1}>
          {timeAgo(match.lastMessageAt, t)}
        </Text>
        {match.unread ? (
          <LinearGradient
            colors={accent.duo}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={[styles.unreadDot, glow(accent.primary, 0.8, 8, 4)]}
          />
        ) : (
          <Ionicons
            name={rtl ? 'chevron-back' : 'chevron-forward'}
            size={15}
            color={colors.textTertiary}
            style={styles.chevron}
          />
        )}
      </View>
    </Pressable>
  );
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    // Unread threads sit on a faintly tinted card so they separate from read
    // ones without needing a second colour language. The border colour is set
    // per row, from the thread's own accent.
    rowUnread: { backgroundColor: withAlpha(colors.textPrimary, 0.04) },
    avatarRing: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, padding: RING_PADDING },
    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: AVATAR / 2 - RING_PADDING,
      backgroundColor: colors.skeleton,
    },
    // The one column that gives. `minWidth: 0` is what lets a long name or a
    // badge be trimmed rather than pushing the timestamp off the row.
    textWrap: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    name: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1 },
    nameUnread: { fontWeight: '800' },
    // Keeps its own width where there is room, and is the first thing to give
    // where there is not — the name matters more than the label.
    badgeWrap: { flexShrink: 1 },
    message: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    // Never squeezed: a timestamp that wraps or ellipsises tells you nothing.
    metaWrap: { alignItems: 'flex-end', gap: spacing.xs, flexShrink: 0 },
    time: { fontSize: scaleFont(11), color: colors.textTertiary, fontWeight: '600' },
    unreadDot: { width: 10, height: 10, borderRadius: 5 },
    chevron: { marginRight: -2 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
