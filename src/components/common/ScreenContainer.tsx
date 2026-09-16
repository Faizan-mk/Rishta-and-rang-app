import React, { useMemo } from 'react';
import { KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
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
      {/* Android's edge-to-edge display (on by default since SDK 54) stopped the
          window from resizing itself for the keyboard, so `undefined` here left
          every form on this container with nothing pushing its focused field
          above the keyboard — 'height' shrinks this view by the keyboard's
          height instead. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
