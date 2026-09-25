import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { NotificationRow } from '../../components/dashboard/NotificationRow';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useNotifications } from '../../store/NotificationContext';
import { useAuth } from '../../store/AuthContext';
import { fonts, radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { feed, unreadCount, markAllRead, markRead } = useNotifications();
  const { user } = useAuth();
  const router = useRouter();
  const accent = modeAccent(colors, user?.activeMode ?? 'dating');

  // A message (or a Rishta step) happened inside a thread — the thread is
  // the honest destination for that tap, same as a tapped push
  // (usePushNavigation). A like or a match is about someone specific instead,
  // with no thread yet, so that one opens their profile.
  const onPressNotification = (item: (typeof feed)[number]) => {
    markRead(item.id);
    if (item.matchId) {
      router.push(`/chat/${item.matchId}`);
      return;
    }
    if (item.relatedId) {
      router.push({ pathname: '/profile-detail', params: { kind: item.relatedKind ?? 'dating', id: item.relatedId } });
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <FadeIn style={styles.header}>
        <AccentHeading
          size="screen"
          title={t('notificationsScreen.title')}
          gradient={accent.ramp}
          right={
            unreadCount > 0 ? (
              <Pressable onPress={markAllRead} style={styles.markAllPill}>
                <Ionicons name="checkmark-done" size={14} color={colors.teal} />
                <Text style={styles.markAllRead}>{t('notificationsScreen.markAllRead')}</Text>
              </Pressable>
            ) : undefined
          }
        />
      </FadeIn>

      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)}
            style={[styles.cell, index === 0 && styles.cellFirst, index === feed.length - 1 && styles.cellLast]}
          >
            <NotificationRow item={item} onPress={() => onPressNotification(item)} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => (
          <View style={styles.cell}>
            <View style={[styles.separator, rtl && styles.separatorRtl]} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={accent.ramp}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.emptyOrb, glow(accent.primary, 0.5, 22, 10)]}
            >
              <Ionicons name="notifications-off" size={30} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('notificationsScreen.empty')}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { marginBottom: spacing.md },
    markAllPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.6),
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 6,
    },
    markAllRead: { ...typography.caption, color: colors.teal, fontFamily: fonts.bodyBold },
    // One white card for the whole feed: each row is a cell of it, the first
    // and last carrying its rounded ends, hairlines inset past the icon.
    cell: {
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.xs,
    },
    cellFirst: {
      borderTopWidth: 1,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingTop: spacing.xs,
    },
    cellLast: {
      borderBottomWidth: 1,
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
      paddingBottom: spacing.xs,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 40 + spacing.md + spacing.sm,
      marginRight: spacing.sm,
    },
    separatorRtl: { marginLeft: spacing.sm, marginRight: 40 + spacing.md + spacing.sm },
    listContent: { paddingBottom: spacing.xl },
    // Mughal-arch frame, the shared empty-state shape.
    emptyOrb: {
      width: 92,
      height: 108,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.sm,
    },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
