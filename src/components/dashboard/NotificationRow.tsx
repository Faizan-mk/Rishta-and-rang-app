import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NotificationItem, NotificationType } from '../../types/content';
import { fonts, radius, spacing, typography } from '../../theme';
import { APP_MODE, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { timeAgo } from '../../utils/time';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  match: 'heart',
  like: 'thumbs-up',
  story_like: 'heart-circle',
  message: 'chatbubble-ellipses',
  rishta_request: 'people',
  system: 'sparkles',
};

// One notification: the photo of the person it is about (who messaged, liked
// or matched), with a small badge for what kind it is, or just the icon when
// there is no one to show. Then the title, one or two lines of detail, and how
// long ago. An unread one has a bold title, a faint tint and a dot; once read
// it settles back to plain text.
export function NotificationRow({
  item,
  photo,
  onPress,
}: {
  item: NotificationItem;
  photo?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const accent = modeAccent(colors, APP_MODE).primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        rtl && styles.rowRtl,
        !item.read && { backgroundColor: withAlpha(accent, 0.06) },
        pressed && styles.pressed,
      ]}
    >
      {photo ? (
        <View style={styles.iconWrap}>
          <Image source={{ uri: photo }} style={styles.avatar} />
          <View style={[styles.badge, rtl ? styles.badgeRtl : styles.badgeLtr, { backgroundColor: accent }]}>
            <Ionicons name={ICONS[item.type]} size={11} color="#FFFFFF" />
          </View>
        </View>
      ) : (
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(accent, item.read ? 0.08 : 0.14) }]}>
          <Ionicons name={ICONS[item.type]} size={20} color={accent} />
        </View>
      )}

      <View style={styles.textWrap}>
        <View style={[styles.titleRow, rtl && styles.rowRtl]}>
          <Text style={[styles.title, !item.read && styles.titleUnread, rtl && styles.rtlText]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.time, !item.read && { color: accent }]} numberOfLines={1}>
            {timeAgo(item.createdAt, t)}
          </Text>
        </View>
        <View style={[styles.bodyRow, rtl && styles.rowRtl]}>
          <Text style={[styles.body, rtl && styles.rtlText]} numberOfLines={2}>
            {item.body}
          </Text>
          {!item.read && <View style={[styles.dot, { backgroundColor: accent }]} />}
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    // Urdu reads right-to-left, so the icon leads from the right edge.
    rowRtl: { flexDirection: 'row-reverse' },
    pressed: { opacity: 0.7 },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.skeleton },
    // The kind of notification, pinned to the photo's lower corner.
    badge: {
      position: 'absolute',
      bottom: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    badgeLtr: { right: -2 },
    badgeRtl: { left: -2 },
    textWrap: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...typography.body, color: colors.textPrimary, flex: 1 },
    titleUnread: { fontFamily: fonts.bodyBold },
    // Never wraps or shrinks; the title gives way instead.
    time: { ...typography.caption, color: colors.textTertiary, flexShrink: 0 },
    bodyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
    body: { ...typography.caption, color: colors.textSecondary, flex: 1 },
    dot: { width: 9, height: 9, borderRadius: 5 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
