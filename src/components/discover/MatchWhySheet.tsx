import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheet } from '../common/BottomSheet';
import { Button } from '../Button';
import { fonts, radius, spacing, typography } from '../../theme';
import { APP_MODE, modeAccent } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

// What "See why you match" opens for Explore+ members: the score, and every
// reason behind it — the same list utils/compatibility built the number from,
// so the two always agree. A thin list says the profile is thin, and points at
// filling in your own.
export function MatchWhySheet({
  visible,
  name,
  score,
  reasons,
  onClose,
  onViewProfile,
  onEditProfile,
}: {
  visible: boolean;
  name: string;
  score: number;
  reasons: string[];
  onClose: () => void;
  onViewProfile: () => void;
  onEditProfile: () => void;
}) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const accent = modeAccent(colors, APP_MODE);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="80%">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, rtl && styles.rowRtl]}>
          <LinearGradient colors={accent.ramp} start={GRADIENT_START} end={GRADIENT_END} style={styles.seal}>
            <Text style={styles.sealValue}>{score}</Text>
            <Text style={styles.sealUnit}>%</Text>
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={[styles.title, rtl && styles.rtlText]}>{t('discover.whyTitle', { name })}</Text>
            <Text style={[styles.subtitle, rtl && styles.rtlText]}>
              {reasons.length > 0 ? t('discover.whySubtitle', { count: reasons.length }) : t('discover.whyEmpty')}
            </Text>
          </View>
        </View>

        {reasons.map((reason) => (
          <View key={reason} style={[styles.reason, rtl && styles.rowRtl]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.reasonText, rtl && styles.rtlText]}>{reason}</Text>
          </View>
        ))}

        <View style={[styles.tip, rtl && styles.rowRtl]}>
          <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.tipText, rtl && styles.rtlText]}>{t('discover.whyTip')}</Text>
        </View>

        <Button label={t('discover.whyViewProfile', { name })} gradient={accent.ramp} onPress={onViewProfile} style={styles.primary} />
        <Button label={t('discover.whyEditProfile')} variant="ghost" onPress={onEditProfile} />
      </ScrollView>
    </BottomSheet>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    rowRtl: { flexDirection: 'row-reverse' },
    seal: {
      width: 64,
      height: 64,
      borderRadius: 32,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      paddingTop: 18,
    },
    sealValue: { color: '#FFFFFF', fontSize: 22, fontFamily: fonts.bodyBold },
    sealUnit: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodyBold },
    headerText: { flex: 1, gap: 2 },
    title: { ...typography.h3, color: colors.textPrimary },
    subtitle: { ...typography.caption, color: colors.textSecondary },
    reason: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.successSoft,
    },
    reasonText: { ...typography.body, color: colors.textPrimary, flex: 1 },
    tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
    tipText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
    primary: { marginTop: spacing.md },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
