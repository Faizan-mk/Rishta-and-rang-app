import React, { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { isValidEmail } from '../../utils/validation';
import { authService } from '../../services/authService';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError(t('login.invalidEmail'));
      return;
    }
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title={t('forgot.title')} onBack={() => router.back()} />

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
        />

        {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}
        {sent ? <Text style={[styles.sentText, rtl && styles.rtlText]}>{t('forgot.sent')}</Text> : null}

        <Button label={t('forgot.submit')} onPress={onSubmit} loading={loading} style={styles.submit} />
        <Button label={t('forgot.backToLogin')} variant="ghost" onPress={() => router.back()} />
      </Animated.View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    submit: { marginTop: spacing.sm },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    sentText: { ...typography.caption, color: colors.teal, marginBottom: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
