import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, secureTextEntry, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  // A secure field gets a reveal toggle so the password isn't a blind guess.
  const [revealed, setRevealed] = useState(false);
  const isSecure = Boolean(secureTextEntry);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, rtl && styles.rtlText]}>{label}</Text>
      {/* The wrap's own border is the focus halo: always 3px, transparent at
          rest, so focusing never shifts the layout. */}
      <View style={[styles.fieldWrap, focused && !error && styles.fieldWrapFocused]}>
        <TextInput
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={isSecure && !revealed}
          style={[
            styles.input,
            isSecure && styles.inputSecure,
            rtl && styles.rtlText,
            // Focus/error state only recolours the border and wash. A glow /
            // elevation shadow on a TextInput triggers the Android elevation
            // renderer, which draws a shadowing block over the text and makes the
            // field look short/cut — so no shadow here.
            focused && styles.inputFocused,
            error && styles.inputError,
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
        {isSecure && (
          <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={8} style={styles.eyeButton}>
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={[styles.error, rtl && styles.rtlText]}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { marginBottom: spacing.md },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs, letterSpacing: 0.3 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: typography.body.fontSize,
      fontFamily: typography.body.fontFamily,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      outlineWidth: 0,
    },
    inputSecure: { paddingRight: spacing.xxl },
    // Negative margin cancels the halo's width so the field lines up with
    // every other control on the form.
    fieldWrap: {
      position: 'relative',
      borderWidth: 3,
      borderColor: 'transparent',
      borderRadius: radius.md + 3,
      margin: -3,
    },
    fieldWrapFocused: { borderColor: colors.tealSoft },
    eyeButton: {
      position: 'absolute',
      right: spacing.sm,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    inputFocused: { borderColor: colors.gold },
    inputError: { borderColor: colors.danger },
    error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
