import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStackScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'CnicVerification'>;

export function CnicVerificationScreen({}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <ScreenContainer>
      <Text style={[styles.title, rtl && styles.rtlText]}>{t('cnic.title')}</Text>

      {user.cnicVerified ? (
        <>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('cnic.detailSubtitle')}</Text>

          {user.cnicPhotoUri && <Image source={{ uri: user.cnicPhotoUri }} style={styles.preview} />}

          <View style={styles.card}>
            <Text style={[styles.label, rtl && styles.rtlText]}>{t('cnic.number')}</Text>
            <Text style={styles.value}>{user.cnicNumber ?? '—'}</Text>
          </View>

          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.verifiedText}>{t('cnic.verified')}</Text>
          </View>
        </>
      ) : (
        <View style={styles.notVerifiedCard}>
          <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
          <Text style={[styles.notVerifiedText, rtl && styles.rtlText]}>{t('cnic.notVerifiedInfo')}</Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    preview: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: colors.skeleton, marginBottom: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    label: { ...typography.label, color: colors.textSecondary, marginBottom: 4 },
    value: { ...typography.h3, color: colors.textPrimary },
    verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    verifiedText: { ...typography.label, color: colors.success },
    notVerifiedCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    notVerifiedText: { ...typography.body, color: colors.textSecondary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
