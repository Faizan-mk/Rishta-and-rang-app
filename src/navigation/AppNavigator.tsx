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
    </Stack.Navigator>
  );
}
