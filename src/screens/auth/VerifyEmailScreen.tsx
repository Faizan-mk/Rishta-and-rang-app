import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { StepHeader } from '../../components/common/StepHeader';
import { OtpVerification } from '../../components/auth/OtpVerification';
import { ArchBadge } from '../../components/common/ArchBadge';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useOnboarding } from '../../store/onboardingStore';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { cardSurface } from '../../theme/surfaces';

// Between step 1 of signup and the photos: the code emailed by SignupScreen is
// typed in here. A correct one leaves a ticket on the draft, and that ticket is
// what lets the account be created at the end of the flow (authService.signup)
// — without it the server refuses. Still step 1 as far as the progress dots go:
// it's part of entering the email, not a step of its own.
export function VerifyEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { draft, patchDraft } = useOnboarding();
  const { resendIn } = useLocalSearchParams<{ resendIn?: string }>();

  // Reached with no draft (a restored nav state, a reload on web): there is no
  // email to verify, so start signup over.
  useEffect(() => {
    if (!draft) router.replace('/signup');
  }, [draft, router]);

  if (!draft) return null;

  const cooldown = Number(resendIn);

  return (
    <ScreenContainer>
      <StepHeader total={3} current={0} onBack={() => router.back()} />
      <Animated.View entering={FadeInUp.duration(400)}>
        <ArchBadge icon="mail-unread-outline" style={styles.badge} />
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('otp.verifyEmailTitle')}</Text>
        <View style={styles.card}>
          <OtpVerification
            email={draft.email.trim().toLowerCase()}
            purpose="signup"
            initialCooldown={Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : 60}
            onVerified={(ticket) => {
              patchDraft({ emailTicket: ticket });
              // Replace, so back from the photos step returns to the form rather
              // than to a code that has already been spent.
              router.replace('/intent-photos');
            }}
            onChangeEmail={() => router.back()}
          />
        </View>
      </Animated.View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: { marginBottom: spacing.md },
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg, textAlign: 'center' },
    card: cardSurface(colors),
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
