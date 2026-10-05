import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/Button';
import { SwingingLogo } from '../../components/common/SwingingLogo';
import { WaveHeader } from '../../components/auth/WaveHeader';
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
    <ScreenContainer edges={['bottom']} style={styles.container}>
      <Animated.View entering={FadeInDown.duration(420)}>
        <WaveHeader
          title={t('login.title')}
          subtitle={t('login.subtitle')}
          badge={<SwingingLogo size={40} color={colors.teal} ringColor="#FFFFFF" />}
          rtl={rtl}
        />
      </Animated.View>

      <View style={styles.body}>
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
        <Pressable
          onPress={() => router.push('/forgot-password')}
          hitSlop={8}
          style={[styles.forgotLink, rtl && styles.forgotLinkRtl]}
        >
          <Text style={styles.forgotLabel}>{t('login.forgotPassword')}</Text>
        </Pressable>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={t('login.submit')}
          onPress={onSubmit}
          loading={loading}
          gradient={[colors.teal, colors.plum]}
          style={styles.submit}
        />
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={[styles.footerText, rtl && styles.rtlText]}>{t('login.noAccount')}</Text>
          <View style={styles.dividerLine} />
        </View>
        <Button
          label={t('login.createAccount')}
          variant="secondary"
          onPress={() => router.push('/signup')}
          style={styles.createButton}
          labelStyle={styles.createLabel}
        />
      </View>
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // The wave header runs edge to edge, so the screen drops its own padding
    // and the form below carries it instead.
    container: { padding: 0, paddingBottom: spacing.lg },
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    submit: { marginTop: spacing.sm },
    forgotLink: { alignSelf: 'flex-end', marginTop: -spacing.xs, marginBottom: spacing.md },
    forgotLinkRtl: { alignSelf: 'flex-start' },
    forgotLabel: { ...typography.label, color: colors.teal },
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
    footer: { marginTop: spacing.lg, gap: spacing.md },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    footerText: { ...typography.caption, color: colors.textSecondary },
    // Secondary action per the design system: outlined champagne-gold pill.
    createButton: { borderColor: colors.gold, backgroundColor: 'transparent' },
    createLabel: { color: colors.textPrimary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
