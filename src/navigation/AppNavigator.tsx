import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { ChatScreen } from '../screens/matches/ChatScreen';
import { CallScreen } from '../screens/matches/CallScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { RishtaProfileScreen } from '../screens/profile/RishtaProfileScreen';
import { ProfileDetailScreen } from '../screens/profile/ProfileDetailScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { ExplorePlusScreen } from '../screens/monetization/ExplorePlusScreen';
import { FavoritesScreen } from '../screens/favorites/FavoritesScreen';
import { PrivacySafetyScreen } from '../screens/settings/PrivacySafetyScreen';
import { BlockedUsersScreen } from '../screens/settings/BlockedUsersScreen';
import { HelpSupportScreen } from '../screens/settings/HelpSupportScreen';
import { CnicVerificationScreen } from '../screens/profile/CnicVerificationScreen';
import { WaliDashboardScreen } from '../screens/profile/WaliDashboardScreen';
import { useLanguage } from '../store/LanguageContext';
import { useTheme } from '../store/ThemeContext';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  const { t } = useLanguage();
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.teal,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Call" component={CallScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: t('editProfile.title') }} />
      <Stack.Screen name="RishtaProfile" component={RishtaProfileScreen} options={{ title: t('rishtaProfile.title') }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('notificationsScreen.title') }} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ExplorePlus" component={ExplorePlusScreen} options={{ title: t('explorePlus.title') }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: t('favorites.title') }} />
      <Stack.Screen name="PrivacySafety" component={PrivacySafetyScreen} options={{ title: t('privacy.title') }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: t('privacy.blockedUsers') }} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: t('help.title') }} />
      <Stack.Screen name="CnicVerification" component={CnicVerificationScreen} options={{ title: t('cnic.title') }} />
      <Stack.Screen name="WaliDashboard" component={WaliDashboardScreen} options={{ title: t('wali.title') }} />
    </Stack.Navigator>
  );
}
