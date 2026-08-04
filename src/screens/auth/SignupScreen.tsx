import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/common/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { isValidEmail } from '../../utils/validation';
import { authService } from '../../services/authService';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const onNext = async () => {
    if (!isValidEmail(email)) {
      setError(t('signup.invalidEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('signup.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch'));
      return;
    }
    setError(null);
    setChecking(true);
    const exists = await authService.emailExists(email);
    setChecking(false);
    if (exists) {
      setError(t('signup.emailTaken'));
      return;
    }
    navigation.navigate('PersonalDetails', { account: { email: email.trim(), password } });
  };

  return (
    <ScreenContainer>
      <StepHeader total={5} current={0} onBack={() => navigation.goBack()} />
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
        <TextField
          label={t('signup.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          onSubmitEditing={onNext}
          returnKeyType="done"
        />

        {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

        <Button label={t('signup.submit')} onPress={onNext} loading={checking} style={styles.submit} />
      </Animated.View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, rtl && styles.rtlText]}>{t('signup.haveAccount')}</Text>
        <Button label={t('signup.logIn')} variant="ghost" onPress={() => navigation.navigate('Login')} />
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    submit: { marginTop: spacing.sm },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    footer: { marginTop: spacing.lg, alignItems: 'center' },
    footerText: { ...typography.body, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
