import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NotificationItem, NotificationType } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { timeAgo } from '../../utils/time';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  match: 'heart',
  like: 'thumbs-up',
  message: 'chatbubble-ellipses',
  rishta_request: 'people',
  system: 'sparkles',
};

export function NotificationRow({ item, onPress }: { item: NotificationItem; onPress?: () => void }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = item.type === 'rishta_request' ? colors.rishta : item.type === 'match' ? colors.dating : colors.teal;
  const toneSoft = item.type === 'rishta_request' ? colors.rishtaSoft : item.type === 'match' ? colors.datingSoft : colors.tealSoft;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, rtl && styles.rowRtl, !item.read && [styles.rowUnread, { borderColor: withAlpha(tone, 0.35) }]]}
    >
      <View
        style={[
          styles.iconWrap,
          rtl ? styles.iconWrapRtl : styles.iconWrapLtr,
          { backgroundColor: toneSoft },
          !item.read && glow(tone, 0.45, 10, 4),
        ]}
      >
        <Ionicons name={ICONS[item.type]} size={18} color={tone} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, rtl && styles.rtlText]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.body, rtl && styles.rtlText]} numberOfLines={2}>{item.body}</Text>
      </View>
      <View style={[styles.metaWrap, rtl ? styles.metaWrapRtl : styles.metaWrapLtr]}>
        <Text style={styles.time}>{timeAgo(item.createdAt, t)}</Text>
        {!item.read && <View style={[styles.dot, { backgroundColor: tone }, glow(tone, 0.8, 8, 3)]} />}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm + 2,
    },
    // Urdu reads right-to-left, so the avatar leads from the right edge and the
    // timestamp trails on the left — the mirror image of the English row.
    rowRtl: { flexDirection: 'row-reverse' },
    // Unread notifications sit on their own tinted card so the list separates
    // into "new" and "seen" without a second colour language.
    rowUnread: { backgroundColor: colors.surfaceElevated },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapLtr: { marginRight: spacing.sm },
    iconWrapRtl: { marginLeft: spacing.sm },
    textWrap: { flex: 1 },
    title: { ...typography.bodyBold, color: colors.textPrimary, fontWeight: '700' },
    body: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    metaWrap: { alignItems: 'flex-end' },
    metaWrapLtr: { marginLeft: spacing.sm },
    metaWrapRtl: { marginRight: spacing.sm, alignItems: 'flex-start' },
    time: { ...typography.caption, color: colors.textTertiary },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
