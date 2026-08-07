import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppStackScreenProps } from '../../navigation/types';
import type { RishtaReadiness } from '../../types/user';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { Badge } from '../../components/common/Badge';
import { FadeIn } from '../../components/common/FadeInUp';
import { SECT_OPTIONS, RELIGION_OPTIONS } from '../../data/sects';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'RishtaProfile'>;

const READINESS_OPTIONS: { key: RishtaReadiness; labelKey: string }[] = [
  { key: 'browsing', labelKey: 'profile.readinessBrowsing' },
  { key: 'few_months', labelKey: 'profile.readinessFewMonths' },
  { key: 'ready_now', labelKey: 'profile.readinessNow' },
];

export function RishtaProfileScreen({ navigation }: Props) {
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

  const onSave = async () => {
    setSaving(true);
    await updateUser({
      ...user,
      rishta: { ...user.rishta, religion: religion ?? '', sect: sect ?? '', familyBackground, education, readiness },
    });
    setSaving(false);
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <FadeIn>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('rishtaProfile.title')}</Text>

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
        <Text style={[styles.label, rtl && styles.rtlText]}>{t('rishtaProfile.readinessLabel')}</Text>
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
          <Text style={[styles.label, rtl && styles.rtlText]}>{t('profile.comingInV2')}</Text>
          <View style={styles.chipRow}>
            <Badge label="Prayer habits" tone="locked" />
            <Badge label="Income range" tone="locked" />
            <Badge label="Living abroad status" tone="locked" />
          </View>
        </View>
      </FadeIn>

      <Button label={t('common.save')} onPress={onSave} loading={saving} style={styles.submit} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
    lockedSection: { marginTop: spacing.md, marginBottom: spacing.lg },
    submit: { marginTop: spacing.md },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
