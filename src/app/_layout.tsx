import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, Theme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from '../store/ThemeContext';
import { LanguageProvider, useLanguage } from '../store/LanguageContext';
import { AuthProvider, useAuth } from '../store/AuthContext';
import { NotificationProvider } from '../store/NotificationContext';
import { MatchesProvider } from '../store/MatchesContext';
import { FavoritesProvider } from '../store/FavoritesContext';
import { ViewHistoryProvider } from '../store/ViewHistoryContext';
import { LikeLimitProvider } from '../store/LikeLimitContext';
import { BoostProvider } from '../store/BoostContext';
import { PrivacyProvider } from '../store/PrivacyContext';
import { DiscoveryProvider }  from '../store/DiscoveryContext';
import { DialogProvider } from '../store/DialogContext';
import { ToastProvider } from '../store/ToastContext';
import { OnboardingProvider } from '../store/onboardingStore';
import { ResponsiveFrame } from '../components/common/ResponsiveFrame';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { usePushNavigation } from '../hooks/usePushNavigation';
import { useActivityHeartbeat } from '../hooks/useActivityHeartbeat';

// The signed-in and signed-out route groups are gated with <Stack.Protected>, so
// a deep link into a protected screen falls back to the anchor route ("index"),
// which forwards the visitor to whichever group they belong in.
function RootNavigator() {
  const { user, initializing } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  // Stores this device's push address once someone is signed in; the sending
  // itself is supabase/functions/send-push, fired from the moments in
  // MatchesContext. The second hook opens whatever a tapped push was about.
  usePushRegistration();
  usePushNavigation();
  // Keeps the "Active now / today" badge honest — see the hook.
  useActivityHeartbeat();

  const navigationTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.teal,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.dating,
      },
    };
  }, [colors, isDark]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <ResponsiveFrame>
        <Stack
          screenOptions={{
            headerTintColor: colors.teal,
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { color: colors.textPrimary },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />

          {/* Outside both guards on purpose: the reset link signs the visitor in
              to authorise the password write, so a screen gated on !user would
              unmount itself the moment the link worked. */}
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />

          <Stack.Protected guard={!user}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="call" options={{ headerShown: false }} />
            <Stack.Screen name="profile-detail" options={{ headerShown: false }} />
            <Stack.Screen name="edit-profile" options={{ title: t('editProfile.title') }} />
            <Stack.Screen name="rishta-profile" options={{ title: t('rishtaProfile.title') }} />
            <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
            <Stack.Screen name="notifications" options={{ title: t('notificationsScreen.title') }} />
            <Stack.Screen name="explore-plus" options={{ title: t('explorePlus.title') }} />
            <Stack.Screen name="favorites" options={{ title: t('favorites.title') }} />
            <Stack.Screen name="privacy-safety" options={{ title: t('privacy.title') }} />
            <Stack.Screen name="blocked-users" options={{ title: t('privacy.blockedUsers') }} />
            <Stack.Screen name="help-support" options={{ title: t('help.title') }} />
            <Stack.Screen name="cnic-verification" options={{ title: t('cnic.title') }} />
            <Stack.Screen name="wali-dashboard" options={{ title: t('wali.title') }} />
            <Stack.Screen name="legal" options={{ title: t('legal.title') }} />
          </Stack.Protected>
        </Stack>
      </ResponsiveFrame>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            {/* Above everything that makes a network call, so a failure has
                somewhere to be said instead of being swallowed. */}
            <ToastProvider>
            <AuthProvider>
              <OnboardingProvider>
                <NotificationProvider>
                  <MatchesProvider>
                    <FavoritesProvider>
                      <ViewHistoryProvider>
                        <LikeLimitProvider>
                          <BoostProvider>
                            <PrivacyProvider>
                              <DiscoveryProvider>
                                <DialogProvider>
                                  <RootNavigator />
                                </DialogProvider>
                              </DiscoveryProvider>
                            </PrivacyProvider>
                          </BoostProvider>
                        </LikeLimitProvider>
                      </ViewHistoryProvider>
                    </FavoritesProvider>
                  </MatchesProvider>
                </NotificationProvider>
              </OnboardingProvider>
            </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
