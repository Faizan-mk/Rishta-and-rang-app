import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Button } from './Button';
import { radius, spacing, typography } from '../../theme';
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
            <Text style={[styles.title, rtl && styles.rtlText]}>{title}</Text>
            {message ? <Text style={[styles.message, rtl && styles.rtlText]}>{message}</Text> : null}

            <View style={styles.actions}>
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
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
    message: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    actionButton: { flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
