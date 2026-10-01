import React, { useMemo } from 'react';
import { KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useKeyboardAvoidingEnabled } from '../../hooks/useKeyboardAvoidingEnabled';
import { spacing } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  edges?: Edge[];
  transparent?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
}

export function ScreenContainer({
  children,
  scroll = true,
  style,
  edges = ['top', 'bottom'],
  transparent,
  onScroll,
  scrollEventThrottle,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const keyboardAvoidingEnabled = useKeyboardAvoidingEnabled();

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, transparent && styles.transparent]} edges={edges}>
      {/* 'padding' on both platforms, and only while the keyboard is up
          (src/hooks/useKeyboardAvoidingEnabled.ts): Android's keyboard-hide event
          measures against the window rather than the screen, which left a
          status-bar-tall blank band at the bottom after it closed. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding" enabled={keyboardAvoidingEnabled}>
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    transparent: { backgroundColor: 'transparent' },
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: spacing.lg },
    content: { flex: 1, padding: spacing.lg },
  });
