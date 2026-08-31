import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, rtl && styles.rtlText]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          rtl && styles.rtlText,
          // A focused field lights up in the brand teal rather than only
          // darkening its border — it reads at a glance on a long form.
          focused && [styles.inputFocused, glow(colors.teal, 0.35, 10, 3)],
          error && [styles.inputError, glow(colors.danger, 0.3, 10, 3)],
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        {...inputProps}
      />
      {error ? <Text style={[styles.error, rtl && styles.rtlText]}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { marginBottom: spacing.md },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '700' },
    input: {
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: typography.body.fontSize,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    inputFocused: { borderColor: colors.teal, backgroundColor: withAlpha(colors.teal, 0.06) },
    inputError: { borderColor: colors.danger },
    error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
