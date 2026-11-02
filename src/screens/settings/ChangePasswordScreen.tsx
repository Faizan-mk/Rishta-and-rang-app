import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { PasswordRequirements } from '../../components/common/PasswordRequirements';
import { Button } from '../../components/Button';
import { authService } from '../../services/authService';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { isStrongPassword } from '../../utils/validation';
import { errorMessage } from '../../utils/appError';
import { radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { flat, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

// Settings → Change password: the current password (so a phone left unlocked
// can't be used to take the account), then the new one twice, held to the same
// rules as signup and "forgot password".
export function ChangePasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const { notify } = useDialog();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setError(null);
    if (!current) {
      setError(t('changePassword.currentRequired'));
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
    if (password === current) {
      setError(t('changePassword.sameAsCurrent'));
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(current, password);
      await notify({ title: t('changePassword.doneTitle'), message: t('changePassword.doneBody') });
      router.back();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer edges={['bottom']}>
      <Animated.View entering={FadeInUp.duration(360)} style={styles.card}>
        <Text style={[styles.intro, rtl && styles.rtlText]}>{t('changePassword.intro')}</Text>
        <TextField
          label={t('changePassword.current')}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="password"
          autoCapitalize="none"
        />
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
              { color: confirmPassword === password ? colors.success : colors.danger },
              rtl && styles.rtlText,
            ]}
          >
            {confirmPassword === password ? t('signup.passwordsMatch') : t('signup.passwordMismatch')}
          </Text>
        )}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
          </View>
        )}
        <Button
          label={t('changePassword.submit')}
          onPress={onSave}
          loading={saving}
          gradient={flat(colors.teal)}
          style={styles.submit}
        />
      </Animated.View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { ...cardSurface(colors), marginTop: spacing.md },
    intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
    passwordMatch: { ...typography.caption, marginTop: -spacing.sm, marginBottom: spacing.md },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: withAlpha(colors.danger, 0.1),
      borderColor: withAlpha(colors.danger, 0.35),
    },
    errorText: { ...typography.caption, color: colors.danger, fontWeight: '700', flexShrink: 1 },
    submit: { marginTop: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
