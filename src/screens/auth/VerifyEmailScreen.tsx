import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ProgressDots } from '../../components/common/ProgressDots';
import { WaveHeader } from '../../components/auth/WaveHeader';
import { OtpVerification } from '../../components/auth/OtpVerification';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useOnboarding } from '../../store/onboardingStore';
import { spacing } from '../../theme';
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
    <ScreenContainer edges={['bottom']} style={styles.container}>
      <WaveHeader
        title={t('otp.verifyEmailTitle')}
        badge={<Ionicons name="mail-unread-outline" size={26} color="#FFFFFF" />}
        onBack={() => router.back()}
        rtl={rtl}
      />
      <Animated.View entering={FadeInUp.duration(400)} style={styles.body}>
        <ProgressDots total={3} current={0} />
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
    // The wave header runs edge to edge, so the screen drops its own padding
    // and the content below carries it instead.
    container: { padding: 0, paddingBottom: spacing.lg },
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    card: cardSurface(colors),
  });
