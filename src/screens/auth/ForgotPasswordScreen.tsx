import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { PasswordRequirements } from '../../components/common/PasswordRequirements';
import { OtpVerification } from '../../components/auth/OtpVerification';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { isStrongPassword, isValidEmail } from '../../utils/validation';
import { AppError, errorMessage } from '../../utils/appError';
import { authService } from '../../services/authService';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

// The whole reset happens on this one screen: email → the 6-digit code from
// that inbox → a new password. The code buys a ticket (authService.verifyOtp),
// and the ticket is what the server accepts for the password write — nothing
// here ever opens a browser or waits on a deep link.
type Phase = 'email' | 'code' | 'password' | 'done';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, language } = useLanguage();

  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [ticket, setTicket] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSendCode = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError(t('login.invalidEmail'));
      return;
    }
    setLoading(true);
    try {
      const { resendIn } = await authService.requestOtp(email, 'reset', language);
      setCooldown(resendIn);
      setPhase('code');
    } catch (e) {
      // Still cooling down from a send moments ago — that code is on its way,
      // so go and wait for it rather than stopping here.
      if (e instanceof AppError && e.key === 'authErrors.otpCooldown') {
        setCooldown(Number(e.params?.seconds ?? 60));
        setPhase('code');
      } else {
        setError(errorMessage(e, t));
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmitPassword = async () => {
    setError(null);
    if (!ticket) return;
    if (!isStrongPassword(password)) {
      setError(t('signup.passwordRequirementsError'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authService.resetPasswordWithOtp(email, ticket, password);
      setPhase('done');
    } catch (e) {
      // A spent or expired ticket can't be retried — back to a fresh code.
      if (e instanceof AppError && e.key === 'authErrors.otpTicketInvalid') {
        setTicket(null);
        setPhase('email');
      }
      setError(errorMessage(e, t, 'reset.failed'));
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    setError(null);
    if (phase === 'code') setPhase('email');
    else router.back();
  };

  const title = phase === 'code' ? t('otp.enterCodeTitle') : phase === 'email' ? t('forgot.title') : t('reset.title');

  const errorCard = error ? (
    <View style={[styles.noticeCard, styles.errorCard]}>
      <Ionicons name="alert-circle" size={16} color={colors.danger} />
      <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
    </View>
  ) : null;

  return (
    <ScreenContainer>
      <Header title={title} onBack={phase === 'done' ? undefined : onBack} />

      {phase === 'email' && (
        <>
          <Animated.View entering={FadeInDown.duration(420)}>
            <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('forgot.subtitle')}</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(120).duration(420)}>
            <TextField
              label={t('login.email')}
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={onSendCode}
            />
            {errorCard}
            <Button
              label={t('forgot.submit')}
              onPress={onSendCode}
              loading={loading}
              gradient={[colors.teal, colors.sage]}
              style={styles.submit}
            />
            <Button label={t('forgot.backToLogin')} variant="ghost" onPress={() => router.back()} />
          </Animated.View>
        </>
      )}

      {phase === 'code' && (
        <Animated.View entering={FadeInUp.duration(420)}>
          <OtpVerification
            email={email.trim().toLowerCase()}
            purpose="reset"
            initialCooldown={cooldown}
            onVerified={(next) => {
              setTicket(next);
              setPhase('password');
            }}
            onChangeEmail={() => setPhase('email')}
          />
        </Animated.View>
      )}

      {phase === 'password' && (
        <>
          <Animated.View entering={FadeInDown.duration(420)}>
            <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('reset.subtitle')}</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(120).duration(420)}>
            <TextField
              label={t('reset.newPassword')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
              autoCapitalize="none"
            />
            {password.length > 0 && <PasswordRequirements password={password} />}
            <TextField
              label={t('reset.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="password-new"
              autoCapitalize="none"
            />
            {confirmPassword.length > 0 && (
              <Text
                style={[
                  styles.passwordMatch,
                  { color: confirmPassword === password ? colors.teal : colors.danger },
                  rtl && styles.rtlText,
                ]}
              >
                {confirmPassword === password ? t('signup.passwordsMatch') : t('signup.passwordMismatch')}
              </Text>
            )}
            {errorCard}
            <Button
              label={t('reset.submit')}
              onPress={onSubmitPassword}
              loading={loading}
              gradient={[colors.teal, colors.sage]}
              style={styles.submit}
            />
          </Animated.View>
        </>
      )}

      {phase === 'done' && (
        <Animated.View entering={FadeInDown.duration(420)}>
          <View style={[styles.noticeCard, styles.sentCard]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.sentText, rtl && styles.rtlText]}>{t('reset.doneBody')}</Text>
          </View>
          <Button
            label={t('reset.goToLogin')}
            onPress={() => router.replace('/login')}
            gradient={[colors.teal, colors.sage]}
            style={styles.submit}
          />
        </Animated.View>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    submit: { marginTop: spacing.sm },
    passwordMatch: { ...typography.caption, marginTop: -spacing.sm, marginBottom: spacing.md },
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    errorCard: { backgroundColor: withAlpha(colors.danger, 0.1), borderColor: withAlpha(colors.danger, 0.35) },
    sentCard: { backgroundColor: withAlpha(colors.success, 0.1), borderColor: withAlpha(colors.success, 0.35) },
    errorText: { ...typography.caption, color: colors.danger, fontWeight: '700', flexShrink: 1 },
    sentText: { ...typography.caption, color: colors.success, fontWeight: '700', flexShrink: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
