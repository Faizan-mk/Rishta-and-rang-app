import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Match } from '../../types/content';
import { Badge } from '../common/Badge';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { timeAgo } from '../../utils/time';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

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
      style={[styles.row, rtl && styles.rowRtl, match.unread && [styles.rowUnread, glow(accent.primary, 0.25, 14, 5)]]}
    >
      <LinearGradient colors={accent.ramp} start={GRADIENT_START} end={GRADIENT_END} style={styles.avatarRing}>
        <Image source={{ uri: match.photo }} style={styles.avatar} />
      </LinearGradient>

      <View style={styles.textWrap}>
        <View style={[styles.nameRow, rtl && styles.rowRtl]}>
          <Text style={[styles.name, match.unread && styles.nameUnread, rtl && styles.rtlText]} numberOfLines={1}>
            {match.name}
          </Text>
          {match.movedToRishta && <Badge label={t('matches.movedToRishta')} tone="rishta" />}
        </View>
        <Text
          style={[styles.message, match.unread && { color: colors.textPrimary }, rtl && styles.rtlText]}
          numberOfLines={1}
        >
          {match.lastMessage}
        </Text>
      </View>

      <View style={styles.metaWrap}>
        <Text style={styles.time}>{timeAgo(match.lastMessageAt)}</Text>
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
    // ones without needing a second colour language.
    rowUnread: { backgroundColor: withAlpha(colors.textPrimary, 0.04), borderColor: colors.border },
    avatarRing: { width: 56, height: 56, borderRadius: 28, padding: 2 },
    avatar: { width: '100%', height: '100%', borderRadius: 26, backgroundColor: colors.skeleton },
    textWrap: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    name: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1 },
    nameUnread: { fontWeight: '800' },
    message: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    metaWrap: { alignItems: 'flex-end', gap: spacing.xs },
    time: { fontSize: scaleFont(11), color: colors.textTertiary, fontWeight: '600' },
    unreadDot: { width: 10, height: 10, borderRadius: 5 },
    chevron: { marginRight: -2 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
