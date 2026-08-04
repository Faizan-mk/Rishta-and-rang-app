import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { Button } from '../../components/common/Button';
import { FloatingHearts } from '../../components/common/FloatingHearts';
import { SwingingLogo } from '../../components/common/SwingingLogo';
import { spacing, typography, radius } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { language, setLanguage, t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <LinearGradient colors={[colors.tealDark, colors.teal]} style={styles.gradient}>
      <FloatingHearts colors={[colors.gold, '#FFFFFF', colors.rishta]} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <SwingingLogo color={colors.teal} ringColor="#FFFFFF" />
          <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={styles.brandTitle}>
            {t('appName')}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(320).duration(500)}
            style={[styles.tagline, rtl && styles.rtlText]}
          >
            {t('language.subtitle')}
          </Animated.Text>
        </View>

        <Animated.View entering={FadeInUp.delay(420).duration(500)} style={styles.card}>
          <View style={styles.langRow}>
            <Button
              label={t('language.english')}
              variant={language === 'en' ? 'primary' : 'secondary'}
              onPress={() => setLanguage('en')}
              style={styles.langButton}
            />
            <Button
              label={t('language.urdu')}
              variant={language === 'ur' ? 'primary' : 'secondary'}
              onPress={() => setLanguage('ur')}
              style={styles.langButton}
            />
          </View>

          <View style={styles.actions}>
            <Button label={t('login.submit')} onPress={() => navigation.navigate('Login')} />
            <Button
              label={t('login.createAccount')}
              variant="ghost"
              onPress={() => navigation.navigate('Signup')}
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
    brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    brandTitle: {
      ...typography.h1,
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: spacing.lg,
    },
    tagline: {
      ...typography.body,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    langRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
    langButton: { flex: 1, marginHorizontal: spacing.xs },
    actions: { gap: spacing.sm },
    rtlText: { writingDirection: 'rtl' },
  });
