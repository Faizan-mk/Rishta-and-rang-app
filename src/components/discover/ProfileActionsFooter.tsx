import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, radius, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

const COMPLIMENT_MAX_LENGTH = 200;

interface ProfileActionsFooterProps {
  name: string;
  onSendCompliment: (text: string) => Promise<void>;
}

// The salaam block at the end of a profile: a short, respectful opener that
// reaches the other side even before a match, in the greeting people here
// actually start conversations with.
export function ProfileActionsFooter({ name, onSendCompliment }: ProfileActionsFooterProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [compliment, setCompliment] = useState('');
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const canSubmit = compliment.trim().length > 0 && !sending;

  const onSubmitCompliment = async () => {
    if (!canSubmit) return;
    setSending(true);
    await onSendCompliment(compliment.trim());
    setSending(false);
    setCompliment('');
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.eyebrow, rtl && styles.rtlText]}>{t('discover.salaamLabel')}</Text>
      <Text style={[styles.heading, rtl && styles.rtlText]}>{t('discover.salaamHeading', { name })}</Text>

      <TextInput
        value={compliment}
        onChangeText={setCompliment}
        placeholder={t('discover.salaamPlaceholder')}
        placeholderTextColor={colors.textTertiary}
        multiline
        maxLength={COMPLIMENT_MAX_LENGTH}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused, rtl && styles.rtlText]}
      />
      <Text style={[styles.charCount, rtl && styles.charCountRtl]}>
        {compliment.length}/{COMPLIMENT_MAX_LENGTH}
      </Text>

      <Pressable onPress={onSubmitCompliment} disabled={!canSubmit}>
        {canSubmit || sending ? (
          <LinearGradient
            colors={[colors.teal, colors.sage]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.submit, glow(colors.teal, 0.5, 16, 7)]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitLabel}>{t('discover.salaamSend')}</Text>
            )}
          </LinearGradient>
        ) : (
          <View style={[styles.submit, styles.submitDisabled]}>
            <Text style={styles.submitLabel}>{t('discover.salaamSend')}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginTop: spacing.xl },
    eyebrow: {
      color: colors.textTertiary,
      fontSize: scaleFont(11),
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    heading: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.md },
    input: {
      minHeight: 96,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: typography.body.fontSize,
      color: colors.textPrimary,
      textAlignVertical: 'top',
      outlineWidth: 0,
    },
    inputFocused: { borderColor: colors.teal },
    charCount: { ...typography.caption, color: colors.textTertiary, textAlign: 'right', marginTop: spacing.xs },
    charCountRtl: { textAlign: 'left' },
    submit: {
      marginTop: spacing.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      minHeight: 48,
    },
    submitDisabled: { backgroundColor: colors.textTertiary, opacity: 0.5 },
    submitLabel: { ...typography.h3, color: '#FFFFFF', fontWeight: '800' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
