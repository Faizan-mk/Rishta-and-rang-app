import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NotificationItem, NotificationType } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
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
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = item.type === 'rishta_request' ? colors.rishta : item.type === 'match' ? colors.dating : colors.teal;
  const toneSoft = item.type === 'rishta_request' ? colors.rishtaSoft : item.type === 'match' ? colors.datingSoft : colors.tealSoft;

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: toneSoft }]}>
        <Ionicons name={ICONS[item.type]} size={18} color={tone} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
      </View>
      <View style={styles.metaWrap}>
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        {!item.read && <View style={[styles.dot, { backgroundColor: tone }]} />}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    textWrap: { flex: 1 },
    title: { ...typography.bodyBold, color: colors.textPrimary },
    body: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    metaWrap: { alignItems: 'flex-end', marginLeft: spacing.sm },
    time: { ...typography.caption, color: colors.textTertiary },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: spacing.xs },
  });
