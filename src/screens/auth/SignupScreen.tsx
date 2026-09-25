import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { Gender } from '../../types/user';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { DateField } from '../../components/common/DateField';
import { SelectField } from '../../components/common/SelectField';
import { Chip } from '../../components/common/Chip';
import { Button } from '../../components/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { PasswordRequirements } from '../../components/common/PasswordRequirements';
import { PAKISTAN_CITIES } from '../../data/locations';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useOnboarding } from '../../store/onboardingStore';
import { isValidEmail, isStrongPassword } from '../../utils/validation';
import { ageFromDob, isValidDobFormat } from '../../utils/date';
import { digitsToCnicDisplay, isValidCnicFormat, cnicMatchesGender } from '../../utils/cnic';
import { authService } from '../../services/authService';
import { AppError, errorMessage } from '../../utils/appError';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import { cardSurface } from '../../theme/surfaces';
import type { Palette } from '../../theme/palettes';

export function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, language } = useLanguage();
  const onboardRamp = [colors.teal, colors.dating] as const;
  const { draft, startDraft } = useOnboarding();

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
  // Self-declared 18+ and acceptance of the two documents. The date of birth is
  // checked as well, below — this is the explicit affirmation the stores ask for,
  // not a substitute for it.
  const [acceptedLegal, setAcceptedLegal] = useState(false);

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
    if (!acceptedLegal) {
      setError(t('signup.mustAcceptLegal'));
      return;
    }

    setError(null);
    setChecking(true);
    try {
      // 'resume' means this address is their own signup that died before the
      // profile rows were written — that one gets waved through, so the flow can
      // finish the account instead of walling them out of it forever. The
      // account already exists, so there is no inbox left to prove.
      const status = await authService.inspectEmail(email, password);
      if (status === 'taken') {
        setError(t('signup.emailTaken'));
        return;
      }

      const normalized = email.trim().toLowerCase();
      // Back on this form after verifying (to fix a typo in the name, say): the
      // ticket still covers the same address, so don't make them do it twice.
      const keptTicket =
        status === 'free' && draft?.emailTicket && draft.email.trim().toLowerCase() === normalized
          ? draft.emailTicket
          : undefined;

      let resendIn: number | null = null;
      if (status === 'free' && !keptTicket) {
        try {
          resendIn = (await authService.requestOtp(normalized, 'signup', language)).resendIn;
        } catch (e) {
          // A code went out moments ago and is still valid — go enter it.
          if (!(e instanceof AppError && e.key === 'authErrors.otpCooldown')) throw e;
          resendIn = Number(e.params?.seconds ?? 60);
        }
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
        emailTicket: keptTicket,
      });

      if (resendIn !== null) {
        router.push({ pathname: '/verify-email', params: { resendIn: String(resendIn) } });
      } else {
        router.push('/intent-photos');
      }
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScreenContainer>
      <StepHeader total={3} current={0} onBack={() => router.back()} />
      <Animated.View entering={FadeInUp.duration(400)}>
        <Text style={[styles.eyebrow, rtl && styles.rtlText]}>{t('signup.subtitle')}</Text>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('signup.title')}</Text>

        <View style={styles.card}>
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
            <Text style={[styles.passwordMatch, { color: confirmPassword === password ? colors.success : colors.danger }, rtl && styles.rtlText]}>
              {confirmPassword === password ? t('signup.passwordsMatch') : t('signup.passwordMismatch')}
            </Text>
          )}
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <AccentHeading
            title={t('personalDetails.title')}
            gradient={onboardRamp}
            style={styles.sectionHeading}
          />

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

          <SelectField label={t('personalDetails.city')} value={city} options={PAKISTAN_CITIES} onChange={setCity} placeholder={t('personalDetails.city')} allowCustom />

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
        </View>

        <View style={[styles.card, styles.cardGap, styles.consentCard]}>
          <Pressable
            onPress={() => setAcceptedLegal((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedLegal }}
            style={[styles.consentRow, rtl && styles.consentRowRtl]}
          >
            <View style={[styles.checkbox, acceptedLegal && styles.checkboxOn]}>
              {acceptedLegal && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
            </View>
            <Text style={[styles.consentText, rtl && styles.rtlText]}>{t('signup.ageAndTermsLabel')}</Text>
          </Pressable>
          <Button
            label={t('signup.reviewLegal')}
            variant="ghost"
            onPress={() => router.push('/legal')}
            labelStyle={styles.linkLabel}
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={t('signup.submit')}
          onPress={onNext}
          loading={checking}
          gradient={onboardRamp}
          style={styles.submit}
        />
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={[styles.footerText, rtl && styles.rtlText]}>{t('signup.haveAccount')}</Text>
          <View style={styles.dividerLine} />
        </View>
        <Button
          label={t('signup.logIn')}
          variant="secondary"
          onPress={() => router.push('/login')}
          style={styles.outlineButton}
          labelStyle={styles.outlineLabel}
        />
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    eyebrow: { ...typography.label, color: colors.gold, letterSpacing: 0.8, marginBottom: spacing.xs },
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
    card: cardSurface(colors),
    cardGap: { marginTop: spacing.md },
    consentCard: { paddingTop: spacing.md },
    sectionHeading: { marginBottom: spacing.md },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm, letterSpacing: 0.3 },
    linkLabel: { ...typography.label, color: colors.teal },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
    bioInput: { minHeight: 70, textAlignVertical: 'top' },
    submit: { marginTop: spacing.md },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: withAlpha(colors.danger, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.35),
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    errorText: { ...typography.caption, color: colors.danger, fontWeight: '700', flexShrink: 1 },
    passwordMatch: { ...typography.caption, marginTop: -spacing.sm, marginBottom: spacing.md },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    consentRowRtl: { flexDirection: 'row-reverse' },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkboxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
    consentText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 19 },
    footer: { marginTop: spacing.lg, gap: spacing.md },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    footerText: { ...typography.caption, color: colors.textSecondary },
    // Secondary action per the design system: outlined champagne-gold pill.
    outlineButton: { borderColor: colors.gold, backgroundColor: 'transparent' },
    outlineLabel: { color: colors.textPrimary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
