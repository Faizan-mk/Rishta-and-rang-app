import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { maskCnic } from '../../utils/cnic';
import { isoToDisplay } from '../../utils/date';
import { fonts, radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

// Read-only. The CNIC number and card photo are fixed once signup has written
// them (supabase/57_cnic_photo_lock.sql); a change goes through the team, which
// is what the support link at the bottom is for.
//
// The stack header already carries the title, so the page opens on the status
// instead of repeating it. The card photo and number start hidden — this is
// the most sensitive thing in the app, and it's often opened with someone
// nearby — and one eye button reveals both.
export function CnicVerificationScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);

  if (!user) return null;

  const verified = Boolean(user.cnicVerified);
  const genderLabel =
    user.gender === 'male'
      ? t('personalDetails.male')
      : user.gender === 'female'
        ? t('personalDetails.female')
        : t('personalDetails.other');
  const rows: { label: string; value: string; secret?: boolean }[] = [
    { label: t('personalDetails.fullName'), value: user.fullName },
    {
      label: t('cnic.number'),
      value: user.cnicNumber ? (revealed ? user.cnicNumber : maskCnic(user.cnicNumber)) : '—',
      secret: Boolean(user.cnicNumber),
    },
    { label: t('personalDetails.dob'), value: isoToDisplay(user.dob) || '—' },
    { label: t('personalDetails.gender'), value: genderLabel },
  ];

  return (
    <ScreenContainer edges={['bottom']}>
      <FadeIn>
        <View style={[styles.status, verified ? styles.statusVerified : styles.statusPending, rtl && styles.rowRtl]}>
          <Ionicons
            name={verified ? 'shield-checkmark' : 'information-circle'}
            size={24}
            color={verified ? colors.success : colors.gold}
          />
          <View style={styles.statusText}>
            <Text style={[styles.statusTitle, { color: verified ? colors.success : colors.textPrimary }, rtl && styles.rtlText]}>
              {verified ? t('cnic.statusVerified') : t('cnic.statusMissing')}
            </Text>
            <Text style={[styles.statusBody, rtl && styles.rtlText]}>
              {verified ? t('cnic.lockedNote') : t('cnic.notVerifiedInfo')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {user.cnicPhotoUri && (
            <Pressable onPress={() => setRevealed((r) => !r)} style={styles.photoWrap}>
              <Image source={{ uri: user.cnicPhotoUri }} style={styles.photo} blurRadius={revealed ? 0 : 18} />
              {!revealed && (
                <BlurView
                  intensity={30}
                  tint={isDark ? 'dark' : 'light'}
                  experimentalBlurMethod="dimezisBlurView"
                  style={[StyleSheet.absoluteFill, styles.photoCover]}
                >
                  <Ionicons name="eye-outline" size={22} color={colors.textPrimary} />
                  <Text style={styles.photoHint}>{t('cnic.tapToShow')}</Text>
                </BlurView>
              )}
            </Pressable>
          )}

          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.row, rtl && styles.rowRtl, index === rows.length - 1 && styles.rowLast]}
            >
              <Text style={[styles.rowLabel, rtl && styles.rtlText]}>{row.label}</Text>
              <View style={[styles.rowValueWrap, rtl && styles.rowRtl]}>
                <Text style={[styles.rowValue, row.secret && styles.mono]} numberOfLines={1}>
                  {row.value}
                </Text>
                {row.secret && (
                  <Pressable
                    onPress={() => setRevealed((r) => !r)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('cnic.tapToShow')}
                  >
                    <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.privateRow, rtl && styles.rowRtl]}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
          <Text style={[styles.privateText, rtl && styles.rtlText]}>{t('cnic.privateNote')}</Text>
        </View>

        <Pressable onPress={() => router.push('/help-support')} style={[styles.help, rtl && styles.rowRtl]}>
          <View style={styles.helpText}>
            <Text style={[styles.helpTitle, rtl && styles.rtlText]}>{t('cnic.wrongDetails')}</Text>
            <Text style={[styles.helpBody, rtl && styles.rtlText]}>{t('cnic.contactSupport')}</Text>
          </View>
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textTertiary} />
        </Pressable>
      </FadeIn>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    status: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    statusVerified: { backgroundColor: colors.successSoft, borderColor: withAlpha(colors.success, 0.35) },
    statusPending: { backgroundColor: colors.goldSoft, borderColor: withAlpha(colors.gold, 0.5) },
    statusText: { flex: 1, gap: 2 },
    statusTitle: { ...typography.bodyBold },
    statusBody: { ...typography.caption, color: colors.textSecondary },
    card: { ...cardSurface(colors), paddingTop: spacing.md, paddingBottom: spacing.xs },
    photoWrap: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.6),
    },
    photo: { width: '100%', height: '100%' },
    photoCover: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
    photoHint: { ...typography.label, color: colors.textPrimary, fontFamily: fonts.bodyBold },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.sm + 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowRtl: { flexDirection: 'row-reverse' },
    rowLabel: { ...typography.caption, color: colors.textSecondary },
    rowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
    rowValue: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
    mono: { letterSpacing: 1 },
    privateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingHorizontal: spacing.xs },
    privateText: { ...typography.caption, color: colors.textTertiary, flex: 1 },
    help: {
      ...cardSurface(colors),
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
    },
    helpText: { flex: 1, gap: 2 },
    helpTitle: { ...typography.bodyBold, color: colors.textPrimary },
    helpBody: { ...typography.caption, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
