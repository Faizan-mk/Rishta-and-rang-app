import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/Button';
import { SwingingLogo } from '../../components/common/SwingingLogo';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { isValidEmail } from '../../utils/validation';
import { errorMessage } from '../../utils/appError';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError(t('login.invalidEmail'));
      return;
    }
    if (!password) {
      setError(t('login.missingPassword'));
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      // RootNavigator swaps to AppNavigator automatically once `user` is set.
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <SwingingLogo size={64} color={colors.teal} ringColor={colors.tealSoft} />
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('login.title')}</Text>
        <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('login.subtitle')}</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(150).duration(420)}>
        <TextField
          label={t('login.email')}
          placeholder={t('login.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField
          label={t('login.password')}
          placeholder={t('login.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={t('login.submit')}
          onPress={onSubmit}
          loading={loading}
          gradient={[colors.teal, colors.sage]}
          style={styles.submit}
        />
        <Button label={t('login.forgotPassword')} variant="ghost" onPress={() => router.push('/forgot-password')} />
      </Animated.View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, rtl && styles.rtlText]}>{t('login.noAccount')}</Text>
        <Button label={t('login.createAccount')} variant="ghost" onPress={() => router.push('/signup')} />
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { alignItems: 'center', marginBottom: spacing.lg },
    title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.md, fontWeight: '800' },
    subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
    submit: { marginTop: spacing.sm },
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
      marginBottom: spacing.sm,
    },
    errorText: { ...typography.caption, color: colors.danger, fontWeight: '700', flexShrink: 1 },
    footer: { marginTop: spacing.lg, alignItems: 'center' },
    footerText: { ...typography.body, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
