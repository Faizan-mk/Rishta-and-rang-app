import React from 'react';
import { Tabs } from 'expo-router';
import { CollapsibleTabBar } from '../../components/CollapsibleTabBar';
import { useLanguage } from '../../store/LanguageContext';
import { useNotifications } from '../../store/NotificationContext';
import { useMatches } from '../../store/MatchesContext';
import { TabBarVisibilityProvider } from '../../store/TabBarVisibilityContext';

export default function TabsLayout() {
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMatches } = useMatches();

  return (
    <TabBarVisibilityProvider>
      <Tabs tabBar={(props) => <CollapsibleTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen
          name="home"
          options={{ title: t('nav.home'), tabBarBadge: unreadCount > 0 ? unreadCount : undefined }}
        />
        <Tabs.Screen name="explore" options={{ title: t('explore.title') }} />
        <Tabs.Screen
          name="messages"
          options={{ title: t('nav.matches'), tabBarBadge: unreadMatches > 0 ? unreadMatches : undefined }}
        />
        <Tabs.Screen name="profile" options={{ title: t('nav.profile') }} />
      </Tabs>
    </TabBarVisibilityProvider>
  );
}
