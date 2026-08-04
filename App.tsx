import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/store/ThemeContext';
import { LanguageProvider } from './src/store/LanguageContext';
import { AuthProvider } from './src/store/AuthContext';
import { NotificationProvider } from './src/store/NotificationContext';
import { MatchesProvider } from './src/store/MatchesContext';
import { FavoritesProvider } from './src/store/FavoritesContext';
import { DialogProvider } from './src/store/DialogContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ResponsiveFrame } from './src/components/common/ResponsiveFrame';

function AppContent() {
  const { isDark } = useTheme();
  return (
    <ResponsiveFrame>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ResponsiveFrame>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <NotificationProvider>
                <MatchesProvider>
                  <FavoritesProvider>
                    <DialogProvider>
                      <AppContent />
                    </DialogProvider>
                  </FavoritesProvider>
                </MatchesProvider>
              </NotificationProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
