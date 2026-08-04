import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { DiscoverScreen } from '../screens/dating/DiscoverScreen';
import { RishtaScreen } from '../screens/rishta/RishtaScreen';
import { MatchesScreen } from '../screens/matches/MatchesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useTheme } from '../store/ThemeContext';
import { useLanguage } from '../store/LanguageContext';
import { useNotifications } from '../store/NotificationContext';
import { useMatches } from '../store/MatchesContext';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Discover: { active: 'flame', inactive: 'flame-outline' },
  Rishta: { active: 'people-circle', inactive: 'people-circle-outline' },
  Matches: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export function MainTabNavigator() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMatches } = useMatches();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel: false,
        tabBarLabel: () => null,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 56,
          paddingTop: 10,
          paddingBottom: 10,
        },
        tabBarItemStyle: { flexDirection: 'column' },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarIcon: ({ focused, color }) => {
          const iconSet = ICONS[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={26} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('nav.home'), tabBarBadge: unreadCount > 0 ? unreadCount : undefined }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: t('nav.discover') }} />
      <Tab.Screen name="Rishta" component={RishtaScreen} options={{ title: t('nav.rishta') }} />
      <Tab.Screen name="Matches" component={MatchesScreen} options={{ title: t('nav.matches'), tabBarBadge: unreadMatches > 0 ? unreadMatches : undefined }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  );
}
