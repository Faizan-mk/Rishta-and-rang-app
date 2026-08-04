import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Match } from '../../types/content';
import { Badge } from '../common/Badge';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { timeAgo } from '../../utils/time';

export const MatchRow = React.memo(function MatchRow({ match, onPress }: { match: Match; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Image source={{ uri: match.photo }} style={styles.avatar} />
      <View style={styles.textWrap}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, rtl && styles.rtlText]}>{match.name}</Text>
          {match.movedToRishta && <Badge label={t('matches.movedToRishta')} tone="rishta" />}
        </View>
        <Text style={[styles.message, rtl && styles.rtlText]} numberOfLines={1}>{match.lastMessage}</Text>
      </View>
      <View style={styles.metaWrap}>
        <Text style={styles.time}>{timeAgo(match.lastMessageAt)}</Text>
        {match.unread && <View style={styles.unreadDot} />}
      </View>
    </Pressable>
  );
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
    avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.skeleton },
    textWrap: { flex: 1, marginLeft: spacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    name: { ...typography.bodyBold, color: colors.textPrimary },
    message: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    metaWrap: { alignItems: 'flex-end', marginLeft: spacing.sm },
    time: { ...typography.caption, color: colors.textTertiary },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.dating, marginTop: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
