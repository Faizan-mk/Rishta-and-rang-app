import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { digitsToDisplay, displayToIso, eighteenYearsAgoIso, isoToDisplay } from '../../utils/date';
import { CalendarModal } from './CalendarModal';

interface DateFieldProps {
  label: string;
  value: string; // ISO 'YYYY-MM-DD', or '' when empty/invalid
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: string;
  maxDateIso?: string;
}

export function DateField({ label, value, onChange, placeholder, error, maxDateIso }: DateFieldProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState(() => (value ? isoToDisplay(value) : ''));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const maxDate = maxDateIso ?? eighteenYearsAgoIso();

  const handleChangeText = (input: string) => {
    const digits = input.replace(/\D/g, '').slice(0, 8);
    const formatted = digitsToDisplay(digits);
    setText(formatted);
    onChange(displayToIso(formatted) ?? '');
  };

  const handleCalendarSelect = (iso: string) => {
    setText(isoToDisplay(iso));
    onChange(iso);
    setCalendarOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, rtl && styles.rtlText]}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          placeholder={placeholder ?? 'DD/MM/YYYY'}
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={10}
          style={[styles.input, rtl && styles.rtlText, error && styles.inputError]}
        />
        <Pressable onPress={() => setCalendarOpen(true)} style={styles.calendarButton} hitSlop={8}>
          <Ionicons name="calendar-outline" size={20} color={colors.teal} />
        </Pressable>
      </View>
      {error ? <Text style={[styles.error, rtl && styles.rtlText]}>{error}</Text> : null}

      <CalendarModal
        visible={calendarOpen}
        initialIso={value || undefined}
        maxDateIso={maxDate}
        onSelect={handleCalendarSelect}
        onClose={() => setCalendarOpen(false)}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { marginBottom: spacing.md },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    input: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: 15,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    inputError: { borderColor: colors.danger },
    calendarButton: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
