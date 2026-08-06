import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { IntentPhotosScreen } from '../screens/auth/IntentPhotosScreen';
import { SelfieVerificationScreen } from '../screens/auth/SelfieVerificationScreen';
import { useTheme } from '../store/ThemeContext';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="IntentPhotos" component={IntentPhotosScreen} />
      <Stack.Screen name="SelfieVerification" component={SelfieVerificationScreen} />
    </Stack.Navigator>
  );
}
