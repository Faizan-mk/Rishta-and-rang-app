import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Button } from '../Button';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmOnly?: boolean;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  confirmOnly,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={confirmOnly ? undefined : onCancel}>
        <Animated.View entering={FadeInUp.duration(220)} style={styles.card}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.flourish}>
              <View style={styles.flourishLine} />
              <View style={styles.flourishDiamond} />
              <View style={styles.flourishLine} />
            </View>
            {/* The title and message scroll; the actions never do. A dialog's
                whole job is to be answered, and a long message on a short
                phone was pushing Cancel off the bottom of the screen — the one
                control you need was the one you could not reach. */}
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false}>
              <Text style={[styles.title, rtl && styles.rtlText]}>{title}</Text>
              {message ? <Text style={[styles.message, rtl && styles.rtlText]}>{message}</Text> : null}
            </ScrollView>

            <View style={[styles.actions, rtl && styles.actionsRtl]}>
              {!confirmOnly && (
                <Button label={cancelLabel ?? t('common.cancel')} variant="secondary" onPress={onCancel} style={styles.actionButton} />
              )}
              <Button
                label={confirmLabel ?? t('common.done')}
                variant={destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
                style={styles.actionButton}
              />
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
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
    card: {
      width: '100%',
      maxWidth: 360,
      // Bounded by the viewport, so a long message scrolls inside the card
      // rather than pushing the card itself off-screen.
      maxHeight: '100%',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg + 4,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.5),
      padding: spacing.md,
      shadowColor: '#2A1720',
      shadowOpacity: 0.2,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    // Gold flourish above the title: the invitation-card rule.
    flourish: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    flourishLine: { width: 22, height: 1, backgroundColor: colors.gold },
    flourishDiamond: { width: 6, height: 6, backgroundColor: colors.gold, transform: [{ rotate: '45deg' }] },
    // Both are capped rather than left to ride `typography`'s device scale: a
    // dialog that grows with the phone grows straight off the screen, which is
    // the opposite of what a larger phone should do.
    body: { flexGrow: 0 },
    bodyContent: { paddingBottom: spacing.xs },
    title: { ...typography.h3, fontSize: scaleFont(17), lineHeight: scaleFont(22), color: colors.textPrimary, marginBottom: spacing.xs },
    message: { ...typography.body, fontSize: scaleFont(14), lineHeight: scaleFont(19), color: colors.textSecondary },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    // Confirm keeps the position closest to the reading edge in both directions.
    actionsRtl: { flexDirection: 'row-reverse' },
    // The Button's own 24px side padding is generous for a full-width action
    // but squeezes two of them onto one row; the text needs the room more.
    actionButton: { flex: 1, paddingHorizontal: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
