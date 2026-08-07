import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { AppStackScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { NotificationRow } from '../../components/dashboard/NotificationRow';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useNotifications } from '../../store/NotificationContext';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'Notifications'>;

export function NotificationsScreen(_props: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { feed, unreadCount, markAllRead, markRead } = useNotifications();

  return (
    <ScreenContainer scroll={false}>
      <FadeIn style={styles.header}>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('notificationsScreen.title')}</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead}>
            <Text style={styles.markAllRead}>{t('notificationsScreen.markAllRead')}</Text>
          </Pressable>
        )}
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
            <Ionicons name="notifications-off-outline" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('notificationsScreen.empty')}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { ...typography.h1, color: colors.textPrimary },
    markAllRead: { ...typography.caption, color: colors.teal, fontWeight: '700' },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft },
    listContent: { paddingBottom: spacing.xl },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
