import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { CollapsibleTabBar } from './CollapsibleTabBar';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ExploreScreen } from '../screens/explore/ExploreScreen';
import { MatchesScreen } from '../screens/matches/MatchesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useLanguage } from '../store/LanguageContext';
import { useNotifications } from '../store/NotificationContext';
import { useMatches } from '../store/MatchesContext';
import { TabBarVisibilityProvider } from '../store/TabBarVisibilityContext';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMatches } = useMatches();

  return (
    <TabBarVisibilityProvider>
      <Tab.Navigator
        tabBar={(props) => <CollapsibleTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('nav.home'), tabBarBadge: unreadCount > 0 ? unreadCount : undefined }} />
        <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: t('explore.title') }} />
        <Tab.Screen name="Matches" component={MatchesScreen} options={{ title: t('nav.matches'), tabBarBadge: unreadMatches > 0 ? unreadMatches : undefined }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.profile') }} />
      </Tab.Navigator>
    </TabBarVisibilityProvider>
  );
}
