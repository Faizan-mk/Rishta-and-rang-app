import React, { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { blockedProfiles, unblockUser } = useMatches();
  // Safety screens keep the app's calm teal rather than a deck's mode colour.
  const safeRamp = [colors.teal, colors.sage] as const;

  const renderItem = ({ item, index }: { item: BlockedProfile; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(320)} style={styles.row}>
      <View style={styles.avatarRing}>
        <Image source={{ uri: item.photo }} style={styles.avatar} />
      </View>
      <Text style={[styles.name, rtl && styles.rtlText]}>{item.name}</Text>
      <Button label={t('privacy.unblock')} variant="secondary" onPress={() => unblockUser(item.id)} style={styles.unblockButton} />
    </Animated.View>
  );

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
        ItemSeparatorComponent={() => <View style={styles.divider} />}
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
    avatarRing: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      padding: 2,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    avatar: { width: '100%', height: '100%', borderRadius: radius.pill, backgroundColor: colors.skeleton },
    name: { ...typography.body, color: colors.textPrimary, flex: 1, fontWeight: '700' },
    unblockButton: { minHeight: 36, paddingHorizontal: spacing.md },
    // The rows are cards now, so the list is spaced rather than ruled.
    divider: { height: spacing.sm },
    emptyOrb: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
