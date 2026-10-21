import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ArchBadge } from '../../components/common/ArchBadge';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { maskCnic } from '../../utils/cnic';
import { fonts, radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

// Read-only. The CNIC number and card photo are fixed once signup has written
// them (supabase/57_cnic_photo_lock.sql); a change goes through the team.
export function CnicVerificationScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);

  if (!user) return null;

  return (
    <ScreenContainer>
      <FadeIn>
        <ArchBadge icon="card-outline" style={styles.badge} />
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('cnic.title')}</Text>

        {user.cnicVerified && (
          <>
            <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('cnic.detailSubtitle')}</Text>

            {user.cnicPhotoUri && <Image source={{ uri: user.cnicPhotoUri }} style={styles.preview} />}

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.label, rtl && styles.rtlText]}>{t('cnic.number')}</Text>
                <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={8}>
                  <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.value}>{user.cnicNumber ? (revealed ? user.cnicNumber : maskCnic(user.cnicNumber)) : '—'}</Text>
            </View>

            <View style={[styles.verifiedRow, rtl && styles.rowRtl]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.verifiedText}>{t('cnic.verified')}</Text>
            </View>
          </>
        )}

        {!user.cnicVerified && (
          <View style={styles.notVerifiedCard}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
            <Text style={[styles.notVerifiedText, rtl && styles.rtlText]}>{t('cnic.notVerifiedInfo')}</Text>
          </View>
        )}
      </FadeIn>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: { marginBottom: spacing.md },
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center' },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
    preview: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.md,
      backgroundColor: colors.skeleton,
      marginBottom: spacing.md,
      borderWidth: 1.5,
      borderColor: withAlpha(colors.gold, 0.7),
    },
    card: { ...cardSurface(colors), paddingBottom: spacing.lg, marginBottom: spacing.md },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    label: { ...typography.label, color: colors.textSecondary, marginBottom: 0 },
    value: { ...typography.h3, color: colors.textPrimary },
    // Pale-emerald seal pill, the design system's "verified" tone.
    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: spacing.xs,
      backgroundColor: colors.successSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    verifiedText: { ...typography.label, color: colors.success, fontFamily: fonts.bodyBold },
    notVerifiedCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.goldSoft,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.5),
      padding: spacing.md,
    },
    notVerifiedText: { ...typography.body, color: colors.textSecondary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
