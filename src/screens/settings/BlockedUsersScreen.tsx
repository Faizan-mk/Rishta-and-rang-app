import React, { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStackScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useMatches, BlockedProfile } from '../../store/MatchesContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'BlockedUsers'>;

export function BlockedUsersScreen({}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { blockedProfiles, unblockUser } = useMatches();

  const renderItem = ({ item }: { item: BlockedProfile }) => (
    <View style={styles.row}>
      <Image source={{ uri: item.photo }} style={styles.avatar} />
      <Text style={[styles.name, rtl && styles.rtlText]}>{item.name}</Text>
      <Button label={t('privacy.unblock')} variant="secondary" onPress={() => unblockUser(item.id)} style={styles.unblockButton} />
    </View>
  );

  return (
    <ScreenContainer scroll={false}>
      <FlatList
        data={blockedProfiles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('privacy.blockedUsersEmpty')}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.skeleton },
    name: { ...typography.body, color: colors.textPrimary, flex: 1 },
    unblockButton: { minHeight: 36, paddingHorizontal: spacing.md },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
