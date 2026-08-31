import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { NotificationRow } from '../../components/dashboard/NotificationRow';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useNotifications } from '../../store/NotificationContext';
import { useAuth } from '../../store/AuthContext';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { feed, unreadCount, markAllRead, markRead } = useNotifications();
  const { user } = useAuth();
  const accent = modeAccent(colors, user?.activeMode ?? 'dating');

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
          <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)}>
            <NotificationRow item={item} onPress={() => markRead(item.id)} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
      borderColor: withAlpha(colors.teal, 0.35),
      backgroundColor: withAlpha(colors.teal, 0.1),
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 6,
    },
    markAllRead: { ...typography.caption, color: colors.teal, fontWeight: '800' },
    // The rows are cards now, so the list is spaced rather than ruled.
    separator: { height: spacing.xs },
    listContent: { paddingBottom: spacing.xl },
    emptyOrb: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
