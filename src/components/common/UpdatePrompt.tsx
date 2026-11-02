import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { Button } from '../Button';
import { useUpdatePrompt } from '../../hooks/useUpdatePrompt';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { APP_MODE, glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

/**
 * "New update available", dressed like the app's other dialogs
 * (ConfirmDialog): the gold-edged card and the gold flourish, with the
 * download mark in the brand ramp. "Not now" and the close button go when the
 * update is required. Logic lives in useUpdatePrompt.
 */
export function UpdatePrompt() {
  const { visible, required, update, later } = useUpdatePrompt();
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const accent = modeAccent(colors, APP_MODE);
  // Home mounts behind the splash and can sit under Welcome for a moment, so
  // wait until a signed-in member actually has Home on screen and the splash
  // has had time to clear.
  const { user, initializing } = useAuth();
  const focused = useIsFocused();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!user || initializing || !focused) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(timer);
  }, [user, initializing, focused]);

  return (
    <Modal visible={visible && settled} transparent animationType="fade" statusBarTranslucent onRequestClose={later}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeInUp.duration(220)} style={styles.card}>
          {!required && (
            <Pressable
              onPress={later}
              hitSlop={10}
              style={[styles.close, rtl ? styles.closeRtl : styles.closeLtr]}
              accessibilityRole="button"
              accessibilityLabel={t('update.later')}
            >
              <Ionicons name="close" size={18} color={colors.textTertiary} />
            </Pressable>
          )}

          <LinearGradient
            colors={accent.ramp}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={[styles.iconOrb, glow(accent.primary, 0.45, 16, 6)]}
          >
            <Ionicons name="download-outline" size={30} color="#FFFFFF" />
            <View style={styles.badge}>
              <Ionicons name="alert" size={12} color="#FFFFFF" />
            </View>
          </LinearGradient>

          <View style={styles.flourish}>
            <View style={styles.flourishLine} />
            <View style={styles.flourishDiamond} />
            <View style={styles.flourishLine} />
          </View>

          <Text style={styles.title}>{t('update.title')}</Text>
          <Text style={styles.message}>{required ? t('update.requiredBody') : t('update.body')}</Text>

          <Button label={t('update.now')} onPress={update} style={styles.button} labelStyle={styles.buttonLabel} />
          {!required && (
            <Pressable onPress={later} hitSlop={8} style={styles.later} accessibilityRole="button">
              <Text style={styles.laterText}>{t('update.later')}</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    // Same card as ConfirmDialog: gold hairline, soft lift.
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg + 4,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.5),
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      shadowColor: '#241F21',
      shadowOpacity: 0.2,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    close: { position: 'absolute', top: spacing.sm, padding: spacing.xs },
    closeLtr: { right: spacing.sm },
    closeRtl: { left: spacing.sm },
    iconOrb: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.gold,
    },
    badge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.danger,
      borderWidth: 2,
      borderColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The gold rule from the app's dialogs, under the mark.
    flourish: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
    flourishLine: { width: 22, height: 1, backgroundColor: colors.gold },
    flourishDiamond: { width: 6, height: 6, backgroundColor: colors.gold, transform: [{ rotate: '45deg' }] },
    title: { ...typography.h3, fontSize: scaleFont(18), lineHeight: scaleFont(24), color: colors.textPrimary, textAlign: 'center' },
    message: {
      ...typography.body,
      fontSize: scaleFont(14),
      lineHeight: scaleFont(20),
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    button: { alignSelf: 'stretch', marginTop: spacing.lg },
    buttonLabel: { fontSize: scaleFont(14) },
    later: { paddingVertical: spacing.sm + 2, marginTop: spacing.xs },
    laterText: { ...typography.label, color: colors.textSecondary },
  });
