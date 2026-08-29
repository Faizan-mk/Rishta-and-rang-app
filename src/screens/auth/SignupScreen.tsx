import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { Gender } from '../../types/user';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { DateField } from '../../components/common/DateField';
import { SelectField } from '../../components/common/SelectField';
import { Chip } from '../../components/common/Chip';
import { Button } from '../../components/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { PAKISTAN_CITIES } from '../../data/locations';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useOnboarding } from '../../store/onboardingStore';
import { isValidEmail } from '../../utils/validation';
import { ageFromDob, isValidDobFormat } from '../../utils/date';
import { digitsToCnicDisplay, isValidCnicFormat, cnicMatchesGender } from '../../utils/cnic';
import { authService } from '../../services/authService';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

export function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { startDraft } = useOnboarding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [city, setCity] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [cnicNumber, setCnicNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const onCnicChange = (input: string) => {
    setCnicNumber(digitsToCnicDisplay(input.replace(/\D/g, '')));
  };

  const onNext = async () => {
    if (!isValidEmail(email)) {
      setError(t('signup.invalidEmail'));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(t('signup.passwordRequirementsError'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch'));
      return;
    }
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
    if (!isValidCnicFormat(cnicNumber)) {
      setError(t('cnic.invalidFormat'));
      return;
    }
    if (!cnicMatchesGender(cnicNumber, gender)) {
      setError(t('cnic.genderMismatch'));
      return;
    }

    setError(null);
    setChecking(true);
    // 'resume' means this address is their own signup that died before the
    // profile rows were written — that one gets waved through, so the flow can
    // finish the account instead of walling them out of it forever.
    const status = await authService.inspectEmail(email, password);
    setChecking(false);
    if (status === 'taken') {
      setError(t('signup.emailTaken'));
      return;
    }

    startDraft({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      dob: dob.trim(),
      gender,
      city,
      bio: bio.trim(),
      cnicNumber,
    });
    router.push('/intent-photos');
  };

  return (
    <ScreenContainer>
      <StepHeader total={3} current={0} onBack={() => router.back()} />
      <Animated.View entering={FadeInUp.duration(400)}>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('signup.title')}</Text>
        <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('signup.subtitle')}</Text>

        <TextField
          label={t('signup.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField
          label={t('signup.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />
        {password.length > 0 && <PasswordRequirements password={password} />}
        <TextField
          label={t('signup.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        {confirmPassword.length > 0 && (
          <Text style={[styles.passwordMatch, { color: confirmPassword === password ? colors.teal : colors.danger }, rtl && styles.rtlText]}>
            {confirmPassword === password ? t('signup.passwordsMatch') : t('signup.passwordMismatch')}
          </Text>
        )}

        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('personalDetails.title')}</Text>

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

        <TextField
          label={t('cnic.number')}
          value={cnicNumber}
          onChangeText={onCnicChange}
          placeholder={t('cnic.numberPlaceholder')}
          keyboardType="number-pad"
          maxLength={15}
        />

        <SelectField label={t('personalDetails.city')} value={city} options={PAKISTAN_CITIES} onChange={setCity} placeholder={t('personalDetails.city')} />

        <TextField
          label={t('personalDetails.bio')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('personalDetails.bioPlaceholder')}
          multiline
          numberOfLines={3}
          style={styles.bioInput}
          onSubmitEditing={onNext}
        />

        {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

        <Button label={t('signup.submit')} onPress={onNext} loading={checking} style={styles.submit} />
      </Animated.View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, rtl && styles.rtlText]}>{t('signup.haveAccount')}</Text>
        <Button label={t('signup.logIn')} variant="ghost" onPress={() => router.push('/login')} />
      </View>
    </ScreenContainer>
  );
}

function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function PasswordRequirements({ password }: { password: string }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const checks = [
    [password.length >= 8, t('signup.passwordRequirementLength')],
    [/[a-z]/.test(password), t('signup.passwordRequirementLower')],
    [/[A-Z]/.test(password), t('signup.passwordRequirementUpper')],
    [/\d/.test(password), t('signup.passwordRequirementNumber')],
    [/[^A-Za-z0-9]/.test(password), t('signup.passwordRequirementSpecial')],
  ] as const;

  return (
    <View style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
      {checks.map(([valid, label]) => (
        <Text key={label} style={{ ...typography.caption, color: valid ? colors.teal : colors.textTertiary, marginBottom: 2, ...(rtl ? { textAlign: 'right', writingDirection: 'rtl' as const } : {}) }}>
          {valid ? '✓' : '○'} {label}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
    bioInput: { minHeight: 70, textAlignVertical: 'top' },
    submit: { marginTop: spacing.sm },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    passwordMatch: { ...typography.caption, marginTop: -spacing.sm, marginBottom: spacing.md },
    footer: { marginTop: spacing.lg, alignItems: 'center' },
    footerText: { ...typography.body, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
