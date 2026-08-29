import React from 'react';
import { Redirect } from 'expo-router';
import { SelfieVerificationScreen } from '../../screens/auth/SelfieVerificationScreen';
import { useOnboarding } from '../../store/onboardingStore';

// Step 3 of signup — needs the draft steps 1 and 2 filled in.
export default function SelfieVerificationRoute() {
  const { draft } = useOnboarding();
  if (!draft) return <Redirect href="/signup" />;
  return <SelfieVerificationScreen />;
}
