import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Button } from '../Button';
import { TextField } from './TextField';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

const REASON_KEYS = [
  'fakeProfile',
  'inappropriate',
  'harassment',
  'spam',
  'underage',
  'other',
] as const;

export type ReportReasonKey = (typeof REASON_KEYS)[number];

interface ReportDialogProps {
  visible: boolean;
  name: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

export function ReportDialog({ visible, name, onCancel, onSubmit }: ReportDialogProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<ReportReasonKey | null>(null);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const reset = () => {
    setSelected(null);
    setCustomText('');
    setError(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleSubmit = () => {
    if (!selected) {
      setError(t('report.missingReason'));
      return;
    }
    if (selected === 'other' && !customText.trim()) {
      setError(t('report.missingCustomText'));
      return;
    }
    const reason = selected === 'other' ? customText.trim() : t(`report.reason_${selected}`);
    reset();
    onSubmit(reason);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Animated.View entering={FadeInUp.duration(220)} style={styles.card}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.title, rtl && styles.rtlText]}>{t('chat.reportConfirmTitle', { name })}</Text>
            <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('report.subtitle')}</Text>

            {REASON_KEYS.map((key) => {
              const isSelected = selected === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSelected(key);
                    setError(null);
                  }}
                  style={[styles.reasonRow, isSelected && styles.reasonRowSelected]}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.reasonText, rtl && styles.rtlText]}>{t(`report.reason_${key}`)}</Text>
                </Pressable>
              );
            })}

            {selected === 'other' && (
              <TextField
                label={t('report.customLabel')}
                value={customText}
                onChangeText={setCustomText}
                placeholder={t('report.customPlaceholder')}
                multiline
                numberOfLines={3}
                style={styles.customInput}
              />
            )}

            {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

            <View style={styles.actions}>
              <Button label={t('common.cancel')} variant="secondary" onPress={handleCancel} style={styles.actionButton} />
              <Button label={t('report.submit')} variant="danger" onPress={handleSubmit} style={styles.actionButton} />
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
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 10 },
      elevation: 16,
    },
    title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '800' },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    reasonRowSelected: { backgroundColor: withAlpha(colors.teal, 0.12) },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: colors.teal, borderWidth: 2 },
    radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.teal },
    reasonText: { ...typography.body, color: colors.textPrimary, flex: 1, fontWeight: '600' },
    customInput: { minHeight: 70, textAlignVertical: 'top', marginTop: spacing.xs },
    errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    actionButton: { flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
