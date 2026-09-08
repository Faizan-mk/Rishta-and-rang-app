import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useOnboardingGate } from '../store/OnboardingGateContext';

// Entry point and anchor route: forwards the visitor into the tabs when signed
// in, into the two-page onboarding intro on a first-ever visit, and to the
// welcome screen otherwise. Reads the same OnboardingGateContext that
// RootNavigator's Stack.Protected guards use, so this redirect always agrees
// with which group is actually mounted — never a separate AsyncStorage read
// that could race or drift out of sync with it.
export default function Index() {
  const { user } = useAuth();
  const { seenOnboarding } = useOnboardingGate();

  if (user) return <Redirect href="/home" />;
  if (seenOnboarding === null) return null;
  return <Redirect href={seenOnboarding ? '/welcome' : '/onboarding'} />;
}
