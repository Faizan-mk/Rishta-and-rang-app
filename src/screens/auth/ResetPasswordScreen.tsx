import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { PasswordRequirements } from '../../components/common/PasswordRequirements';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { authService } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { isStrongPassword } from '../../utils/validation';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

// Where the reset email lands. The link carries a recovery credential which
// openPasswordResetLink trades for a session, and that session is what lets
// updateUser write a new password for an account nobody can log into.
//
// This screen is registered at the top level rather than inside (auth), because
// that group is gated on there being no signed-in user: the session the link
// creates would unmount this screen mid-reset and drop the visitor into the
// tabs with their old password still in place.
type Phase = 'verifying' | 'ready' | 'invalid' | 'done';

type ExitRoute = '/login' | '/forgot-password';

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { logout } = useAuth();

  const url = Linking.useURL();
  const [phase, setPhase] = useState<Phase>('verifying');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A link is spendable once, so it is tracked and never re-consumed — a
  // re-render or a second emission of the same URL must not re-run the exchange.
  const consumed = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // useURL is null on the first render of a cold start; getInitialURL is
      // what actually resolves the link the app was opened with.
      const link = url ?? (await Linking.getInitialURL());
      if (cancelled) return;

      if (link) {
        if (consumed.current === link) return;
        consumed.current = link;
        try {
          await authService.openPasswordResetLink(link);
          if (!cancelled) setPhase('ready');
        } catch (e) {
          if (cancelled) return;
          setLinkError(messageFrom(e, t('reset.invalidBody')));
          setPhase('invalid');
        }
        return;
      }

      // Opened with no link in hand. On web the fragment is consumed by
      // detectSessionInUrl before this runs, so a live session is the evidence
      // that a reset is in progress; without one there is nothing to act on.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setPhase(data.session ? 'ready' : 'invalid');
    })();

    return () => {
      cancelled = true;
    };
  }, [url, t]);

  // Leaving the reset ends the recovery session with it — both because a
  // half-finished reset should not leave someone signed in, and because /login
  // lives in the group that only exists while there is no user.
  const leave = async (to: ExitRoute) => {
    await logout().catch(() => undefined);
    router.replace(to);
  };

  const onSubmit = async () => {
    setError(null);
    if (!isStrongPassword(password)) {
      setError(t('signup.passwordRequirementsError'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      await authService.updatePassword(password);
      // The new password is in the database now; the recovery session has done
      // its job, so it ends here and the next sign-in uses the new password.
      await logout().catch(() => undefined);
      setPhase('done');
    } catch (e) {
      setError(messageFrom(e, t('reset.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title={t('reset.title')} onBack={() => leave('/login')} />

      {phase === 'verifying' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.teal} size="large" />
          <Text style={[styles.subtitle, styles.centredText]}>{t('reset.verifying')}</Text>
        </View>
      )}

      {phase === 'invalid' && (
        <Animated.View entering={FadeInDown.duration(420)}>
          <View style={[styles.noticeCard, styles.errorCard]}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.errorText, rtl && styles.rtlText]}>{linkError ?? t('reset.invalidBody')}</Text>
          </View>
          <Button
            label={t('reset.requestNew')}
            onPress={() => leave('/forgot-password')}
            gradient={[colors.teal, colors.sage]}
            style={styles.submit}
          />
          <Button label={t('forgot.backToLogin')} variant="ghost" onPress={() => leave('/login')} />
        </Animated.View>
      )}

      {phase === 'ready' && (
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

            {error ? (
              <View style={[styles.noticeCard, styles.errorCard]}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
              </View>
            ) : null}

            <Button
              label={t('reset.submit')}
              onPress={onSubmit}
              loading={saving}
              gradient={[colors.teal, colors.sage]}
              style={styles.submit}
            />
            <Button label={t('reset.cancel')} variant="ghost" onPress={() => leave('/login')} />
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
    centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
    centredText: { marginTop: spacing.md, textAlign: 'center' },
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
