import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { RishtaReadiness } from '../../types/user';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { Button } from '../../components/Button';
import { Chip } from '../../components/common/Chip';
import { Badge } from '../../components/common/Badge';
import { FadeIn } from '../../components/common/FadeInUp';
import { SECT_OPTIONS, RELIGION_OPTIONS } from '../../data/sects';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const READINESS_OPTIONS: { key: RishtaReadiness; labelKey: string }[] = [
  { key: 'browsing', labelKey: 'profile.readinessBrowsing' },
  { key: 'few_months', labelKey: 'profile.readinessFewMonths' },
  { key: 'ready_now', labelKey: 'profile.readinessNow' },
];

export function RishtaProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser } = useAuth();

  const [religion, setReligion] = useState<string | null>(user?.rishta.religion || null);
  const [sect, setSect] = useState<string | null>(user?.rishta.sect || null);
  const [familyBackground, setFamilyBackground] = useState(user?.rishta.familyBackground ?? '');
  const [education, setEducation] = useState(user?.rishta.education ?? '');
  const [readiness, setReadiness] = useState<RishtaReadiness>(user?.rishta.readiness ?? 'browsing');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const accent = modeAccent(colors, 'rishta');

  const onSave = async () => {
    setSaving(true);
    await updateUser({
      ...user,
      rishta: { ...user.rishta, religion: religion ?? '', sect: sect ?? '', familyBackground, education, readiness },
    });
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer>
      <FadeIn>
        <LinearGradient
          colors={accent.ramp}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, glow(accent.primary, 0.45, 20, 9)]}
        >
          <View style={styles.heroGlow} pointerEvents="none" />
          <View style={styles.heroIcon}>
            <Ionicons name="heart-circle" size={22} color="#FFFFFF" />
          </View>
          <Text style={[styles.heroTitle, rtl && styles.rtlText]}>{t('rishtaProfile.title')}</Text>
        </LinearGradient>

        <SelectField label={t('profile.religion')} value={religion} options={RELIGION_OPTIONS} onChange={setReligion} placeholder={t('rishtaProfile.religionPlaceholder')} />
        <SelectField label={t('profile.sect')} value={sect} options={SECT_OPTIONS} onChange={setSect} placeholder={t('rishtaProfile.sectPlaceholder')} />
        <TextField
          label={t('profile.familyBackground')}
          value={familyBackground}
          onChangeText={setFamilyBackground}
          placeholder={t('rishtaProfile.familyPlaceholder')}
          multiline
        />
        <TextField label={t('profile.education')} value={education} onChangeText={setEducation} placeholder={t('rishtaProfile.educationPlaceholder')} />
      </FadeIn>

      <FadeIn delay={100}>
        <AccentHeading title={t('rishtaProfile.readinessLabel')} gradient={accent.duo} style={styles.heading} />
        <View style={styles.chipRow}>
          {READINESS_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={t(option.labelKey)}
              tone="rishta"
              selected={readiness === option.key}
              onPress={() => setReadiness(option.key)}
            />
          ))}
        </View>

        <View style={styles.lockedSection}>
          <AccentHeading
            title={t('profile.comingInV2')}
            gradient={[colors.textTertiary, colors.border]}
            style={styles.heading}
          />
          <View style={styles.chipRow}>
            <Badge label={t('profile.prayerHabits')} tone="locked" />
            <Badge label={t('profile.incomeRange')} tone="locked" />
            <Badge label={t('profile.livingAbroadStatus')} tone="locked" />
          </View>
        </View>
      </FadeIn>

      <Button
        label={t('common.save')}
        onPress={onSave}
        loading={saving}
        gradient={accent.ramp}
        style={styles.submit}
      />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    hero: {
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      top: -60,
      right: -30,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { ...typography.h1, color: '#FFFFFF', fontWeight: '800' },
    heading: { marginBottom: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
    lockedSection: {
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: withAlpha(colors.textPrimary, 0.03),
      padding: spacing.md,
    },
    submit: { marginTop: spacing.md },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
