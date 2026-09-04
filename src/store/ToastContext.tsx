import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography } from '../theme';
import { withAlpha } from '../theme/glow';
import type { Palette } from '../theme/palettes';
import { useTheme } from './ThemeContext';
import { useLanguage } from './LanguageContext';

interface ToastRequest {
  /** A dictionary path, not a sentence — the toast is rendered in the reader's language. */
  messageKey: string;
  /** Offered beside the message. Omit when there is nothing sensible to retry. */
  onRetry?: () => void;
}

interface ToastContextValue {
  /**
   * Says that something did not work, and offers the way back where there is
   * one. Deliberately the only shape: a failure the member is not told about is
   * the thing this exists to stop.
   */
  showError: (request: ToastRequest) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Long enough to read a line and reach the button, short enough not to sit over
// the thing the member is trying to look at.
const VISIBLE_MS = 6000;

/**
 * A failure notice that does not interrupt.
 *
 * The alternative already in the app is `DialogContext`, which is modal and
 * demands an answer — right for "block this person?", wrong for "that like did
 * not go through", which needs to be seen and then forgotten. Network failures
 * go here; decisions stay there.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [toast, setToast] = useState<ToastRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showError = useCallback((request: ToastRequest) => {
    // A second failure replaces the first rather than queueing behind it: the
    // newest one is the one the member just caused.
    if (timer.current) clearTimeout(timer.current);
    setToast(request);
    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onRetry = () => {
    const retry = toast?.onRetry;
    dismiss();
    retry?.();
  };

  const value = useMemo(() => ({ showError }), [showError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOutDown.duration(160)}
          // Above the tab bar and the home indicator, so it never lands under
          // either. `pointerEvents` on the wrapper so the rest of the screen
          // stays usable while it is up.
          style={[styles.wrap, { bottom: insets.bottom + spacing.xl + spacing.lg }]}
          pointerEvents="box-none"
        >
          <View style={[styles.toast, rtl && styles.toastRtl]}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
            <Text style={[styles.message, rtl && styles.rtlText]} numberOfLines={2}>
              {t(toast.messageKey)}
            </Text>
            {toast.onRetry ? (
              <Pressable onPress={onRetry} style={styles.action} accessibilityRole="button">
                <Text style={styles.actionLabel}>{t('netErrors.retry')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={dismiss} style={styles.close} accessibilityRole="button">
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: spacing.md, right: spacing.md },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.35),
    },
    toastRtl: { flexDirection: 'row-reverse' },
    message: { ...typography.caption, color: colors.textPrimary, flex: 1, fontWeight: '600' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    action: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.teal, 0.12),
    },
    actionLabel: { ...typography.label, color: colors.teal, fontWeight: '800' },
    close: { padding: spacing.xs },
  });
