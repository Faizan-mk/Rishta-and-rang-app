import React, { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/Button';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useMatches, BlockedProfile } from '../../store/MatchesContext';
import { radius, spacing, typography } from '../../theme';
import { glow } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function BlockedUsersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { blockedProfiles, unblockUser, getMatchForProfile } = useMatches();
  // Safety screens keep the app's calm teal rather than a deck's mode colour.
  const safeRamp = [colors.teal, colors.dating] as const;

  const renderItem = ({ item, index }: { item: BlockedProfile; index: number }) => {
    // Blocking keeps the thread now (supabase/35_block_keeps_thread.sql), so
    // there is somewhere to go back to — unless this block predates that, or
    // the thread was unmatched separately, in which case there is nothing to
    // open and the row is just the unblock action.
    const match = getMatchForProfile(item.id);
    return (
      <Animated.View
        entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)}
        style={[styles.cell, index === 0 && styles.cellFirst, index === blockedProfiles.length - 1 && styles.cellLast]}
      >
        <Pressable
          style={[styles.row, rtl && styles.rowRtl]}
          onPress={match ? () => router.push(`/chat/${match.id}`) : undefined}
          disabled={!match}
        >
          <View style={styles.avatarRing}>
            <Image source={{ uri: item.photo }} style={styles.avatar} />
          </View>
          <Text style={[styles.name, rtl && styles.rtlText]}>{item.name}</Text>
          <Button
            label={t('privacy.unblock')}
            variant="secondary"
            onPress={() => unblockUser(item.id)}
            style={styles.unblockButton}
            labelStyle={styles.unblockLabel}
          />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScreenContainer scroll={false}>
      <AccentHeading
        size="screen"
        title={t('privacy.blockedUsers')}
        gradient={safeRamp}
        style={styles.heading}
      />

      <FlatList
        data={blockedProfiles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <View style={styles.cell}>
            <View style={[styles.divider, rtl && styles.dividerRtl]} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={safeRamp}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.emptyOrb, glow(colors.teal, 0.5, 22, 10)]}
            >
              <Ionicons name="shield-checkmark" size={30} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('privacy.blockedUsersEmpty')}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    heading: { marginBottom: spacing.md },
    // One white card for the list: rows are its cells, the first and last
    // carrying the rounded ends, hairlines inset past the avatar.
    cell: {
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.xs,
    },
    cellFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
    cellLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    avatarRing: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      padding: 2,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    avatar: { width: '100%', height: '100%', borderRadius: radius.pill, backgroundColor: colors.skeleton },
    name: { ...typography.h3, color: colors.textPrimary, flex: 1 },
    // Outlined champagne-gold pill, the design system's secondary action.
    unblockButton: { minHeight: 38, paddingHorizontal: spacing.md, borderColor: colors.gold, backgroundColor: 'transparent' },
    unblockLabel: { ...typography.label, color: colors.textPrimary },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 48 + spacing.md + spacing.sm,
      marginRight: spacing.sm,
    },
    dividerRtl: { marginLeft: spacing.sm, marginRight: 48 + spacing.md + spacing.sm },
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
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
