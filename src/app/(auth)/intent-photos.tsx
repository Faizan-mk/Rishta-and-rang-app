import React from 'react';
import { Redirect } from 'expo-router';
import { IntentPhotosScreen } from '../../screens/auth/IntentPhotosScreen';
import { useOnboarding } from '../../store/onboardingStore';

// Step 2 of signup. Reloading straight onto this URL (a refresh on web, a deep
// link) leaves no draft to extend, so the flow restarts at step 1.
export default function IntentPhotosRoute() {
  const { draft } = useOnboarding();
  if (!draft) return <Redirect href="/signup" />;
  return <IntentPhotosScreen />;
}
