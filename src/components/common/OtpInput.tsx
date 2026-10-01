import React, { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  /** Fired once the last digit lands, with the full code. */
  onComplete?: (code: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}

/**
 * One box per digit, backed by a single invisible TextInput laid over them.
 *
 * One real input rather than six: paste, the keyboard's one-time-code
 * suggestion (iOS offers codes it reads out of Mail) and backspace all behave
 * the way the platform expects, with no focus hopping to get wrong. The boxes
 * are only a picture of `value`.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  disabled,
  autoFocus = true,
  accessibilityLabel,
}: OtpInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const onChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  };

  const activeIndex = Math.min(value.length, length - 1);

  return (
    // Digits read left to right in every language, Urdu included.
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()} disabled={disabled}>
      {Array.from({ length }, (_, i) => {
        const digit = value[i] ?? '';
        const isActive = focused && i === activeIndex && !disabled;
        return (
          <View
            key={i}
            style={[styles.box, digit !== '' && styles.boxFilled, isActive && styles.boxActive, error && styles.boxError]}
          >
            <Text style={styles.digit}>{digit}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        testID="otp-input"
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus={autoFocus}
        editable={!disabled}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      direction: 'ltr',
      justifyContent: 'space-between',
      gap: spacing.xs,
      marginBottom: spacing.md,
      position: 'relative',
    },
    box: {
      flex: 1,
      maxWidth: 52,
      aspectRatio: 0.85,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxFilled: { borderColor: withAlpha(colors.teal, 0.45), backgroundColor: colors.surface },
    // Focus follows the text field: gold border on a blush wash.
    boxActive: { borderColor: colors.gold, backgroundColor: colors.tealSoft },
    boxError: { borderColor: colors.danger, backgroundColor: withAlpha(colors.danger, 0.06) },
    digit: { ...typography.h2, fontSize: 26, lineHeight: 32, color: colors.textPrimary },
    // Covers the boxes so a tap anywhere lands in the input. Not opacity 0 —
    // some Android keyboards refuse to open for a fully transparent field.
    hiddenInput: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.011,
      color: 'transparent',
      fontSize: 1,
    },
  });
