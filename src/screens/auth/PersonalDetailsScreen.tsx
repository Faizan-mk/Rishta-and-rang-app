import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import type { Gender } from '../../types/user';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { DateField } from '../../components/common/DateField';
import { SelectField } from '../../components/common/SelectField';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { StepHeader } from '../../components/common/StepHeader';
import { PAKISTAN_CITIES } from '../../data/locations';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { ageFromDob, isValidDobFormat } from '../../utils/date';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = NativeStackScreenProps<AuthStackParamList, 'PersonalDetails'>;

export function PersonalDetailsScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { account } = route.params;

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [city, setCity] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onNext = () => {
    if (!fullName.trim() || !dob.trim() || !city) {
      setError(t('personalDetails.missingFields'));
      return;
    }
    if (!isValidDobFormat(dob.trim())) {
      setError(t('personalDetails.invalidDob'));
      return;
    }
    const age = ageFromDob(dob.trim());
    if (age === null || age < 18) {
      setError(t('personalDetails.tooYoung'));
      return;
    }
    setError(null);
    navigation.navigate('IntentSelection', {
      draft: { ...account, fullName: fullName.trim(), dob: dob.trim(), gender, city, bio: bio.trim() },
    });
  };

  return (
    <ScreenContainer>
      <StepHeader total={5} current={1} onBack={() => navigation.goBack()} />
      <Animated.View entering={FadeInUp.duration(400)}>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('personalDetails.title')}</Text>
        <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('personalDetails.subtitle')}</Text>

        <TextField label={t('personalDetails.fullName')} value={fullName} onChangeText={setFullName} autoComplete="name" />
        <DateField
          label={t('personalDetails.dob')}
          value={dob}
          onChange={setDob}
          placeholder={t('personalDetails.dobPlaceholder')}
        />

        <Text style={[styles.label, rtl && styles.rtlText]}>{t('personalDetails.gender')}</Text>
        <View style={styles.row}>
          <Chip label={t('personalDetails.male')} selected={gender === 'male'} onPress={() => setGender('male')} />
          <Chip label={t('personalDetails.female')} selected={gender === 'female'} onPress={() => setGender('female')} />
          <Chip label={t('personalDetails.other')} selected={gender === 'other'} onPress={() => setGender('other')} />
        </View>

        <SelectField label={t('personalDetails.city')} value={city} options={PAKISTAN_CITIES} onChange={setCity} placeholder={t('personalDetails.city')} />

        <TextField
          label={t('personalDetails.bio')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('personalDetails.bioPlaceholder')}
          multiline
          numberOfLines={3}
          style={styles.bioInput}
        />

        {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

        <Button label={t('personalDetails.submit')} onPress={onNext} style={styles.submit} />
      </Animated.View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
    bioInput: { minHeight: 70, textAlignVertical: 'top' },
    submit: { marginTop: spacing.sm },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
