import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { PersonalDetailsScreen } from '../screens/auth/PersonalDetailsScreen';
import { IntentSelectionScreen } from '../screens/auth/IntentSelectionScreen';
import { PhotoUploadScreen } from '../screens/auth/PhotoUploadScreen';
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
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <Stack.Screen name="IntentSelection" component={IntentSelectionScreen} />
      <Stack.Screen name="PhotoUpload" component={PhotoUploadScreen} />
      <Stack.Screen name="SelfieVerification" component={SelfieVerificationScreen} />
    </Stack.Navigator>
  );
}
