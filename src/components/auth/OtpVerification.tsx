import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OtpInput } from '../common/OtpInput';
import { Button } from '../Button';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { authService, type OtpPurpose } from '../../services/authService';
import { AppError, errorMessage } from '../../utils/appError';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const CODE_LENGTH = 6;

interface OtpVerificationProps {
  email: string;
  purpose: OtpPurpose;
  /** Seconds left on the cooldown from the send that brought the member here. */
  initialCooldown?: number;
  /** Called with the ticket once the code checks out. */
  onVerified: (ticket: string) => void | Promise<void>;
  onChangeEmail: () => void;
}

/**
 * The "enter the code we emailed you" step, shared by signup and forgot
 * password: six boxes, a verify button that also fires on the last digit, and
 * a resend link that counts down its own cooldown. The limits themselves live
 * server-side (supabase/functions/auth-otp); the countdown here only mirrors
 * them so the member isn't invited to tap something that will be refused.
 */
export function OtpVerification({ email, purpose, initialCooldown = 60, onVerified, onChangeEmail }: OtpVerificationProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, language } = useLanguage();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);
  // A code that has been locked out or expired can't be retried; the member
  // needs a fresh one, so the verify button steps aside for resend.
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const inFlight = useRef(false);

  const hasCooldown = cooldown > 0;
  useEffect(() => {
    if (!hasCooldown) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [hasCooldown]);

  const verify = async (value: string = code) => {
    if (value.length !== CODE_LENGTH || inFlight.current || needsNewCode) return;
    inFlight.current = true;
    setError(null);
    setNotice(null);
    setVerifying(true);
    try {
      const ticket = await authService.verifyOtp(email, purpose, value);
      await onVerified(ticket);
    } catch (e) {
      setError(errorMessage(e, t));
      setCode('');
      if (e instanceof AppError && (e.key === 'authErrors.otpTooManyAttempts' || e.key === 'authErrors.otpExpired')) {
        setNeedsNewCode(true);
      }
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (hasCooldown || resending) return;
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const { resendIn } = await authService.requestOtp(email, purpose, language);
      setCooldown(resendIn);
      setCode('');
      setNeedsNewCode(false);
      setNotice(t('otp.resent'));
    } catch (e) {
      if (e instanceof AppError && typeof e.params?.seconds === 'number') setCooldown(e.params.seconds);
      setError(errorMessage(e, t));
    } finally {
      setResending(false);
    }
  };

  return (
    <View>
      <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('otp.sentTo', { email })}</Text>

      <Text style={[styles.label, rtl && styles.rtlText]}>{t('otp.codeLabel')}</Text>
      <OtpInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (error) setError(null);
        }}
        onComplete={(full) => verify(full)}
        length={CODE_LENGTH}
        error={Boolean(error)}
        disabled={verifying || needsNewCode}
        accessibilityLabel={t('otp.codeLabel')}
      />
      <Text style={[styles.hint, rtl && styles.rtlText]}>{t('otp.hint')}</Text>

      {error ? (
        <View style={[styles.noticeCard, styles.errorCard]}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View style={[styles.noticeCard, styles.sentCard]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.sentText, rtl && styles.rtlText]}>{notice}</Text>
        </View>
      ) : null}

      {!needsNewCode && (
        <Button
          label={t('otp.verify')}
          onPress={() => verify()}
          loading={verifying}
          disabled={code.length !== CODE_LENGTH}
          gradient={[colors.teal, colors.dating]}
          style={styles.submit}
        />
      )}
      <Button
        label={hasCooldown ? t('otp.resendIn', { seconds: cooldown }) : t('otp.resend')}
        variant={needsNewCode ? 'primary' : 'ghost'}
        onPress={resend}
        loading={resending}
        disabled={hasCooldown}
        style={needsNewCode ? styles.submit : undefined}
      />
      <Button label={t('otp.changeEmail')} variant="ghost" onPress={onChangeEmail} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs, letterSpacing: 0.3 },
    hint: { ...typography.caption, color: colors.textTertiary, marginTop: -spacing.xs, marginBottom: spacing.md },
    submit: { marginTop: spacing.sm },
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
