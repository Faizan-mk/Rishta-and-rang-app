import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface SelectFieldProps {
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
  allowAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  error?: string;
}

export function SelectField({ label, value, options, onChange, allowAll, allLabel, placeholder, error }: SelectFieldProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = query.trim() ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())) : options;
    return allowAll ? [allLabel ?? 'All', ...list] : list;
  }, [options, query, allowAll, allLabel]);

  const displayValue = value ?? (allowAll ? allLabel ?? 'All' : null);

  const select = (option: string) => {
    if (allowAll && option === (allLabel ?? 'All')) {
      onChange(null);
    } else {
      onChange(option);
    }
    setQuery('');
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, rtl && styles.rtlText]}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={[styles.field, error && styles.fieldError]}>
        <Text style={[styles.value, !displayValue && styles.placeholder, rtl && styles.rtlText]}>
          {displayValue ?? placeholder ?? '—'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Animated.View entering={SlideInDown.duration(280).springify().damping(18)} style={styles.sheet}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, rtl && styles.rtlText]}>{label}</Text>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={colors.textTertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, rtl && styles.rtlText]}
                  autoCapitalize="words"
                />
              </View>
              <FlatList
                data={filtered}
                keyExtractor={(item) => item}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = item === displayValue;
                  return (
                    <Pressable onPress={() => select(item)} style={styles.option}>
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected, rtl && styles.rtlText]}>{item}</Text>
                      {isSelected && <Ionicons name="checkmark" size={18} color={colors.teal} />}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>{t('common.noResults')}</Text>}
              />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { marginBottom: spacing.md },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      backgroundColor: colors.surface,
    },
    fieldError: { borderColor: colors.danger },
    value: { ...typography.body, color: colors.textPrimary },
    placeholder: { color: colors.textTertiary },
    errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.lg,
      maxHeight: '75%',
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    sheetTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    searchInput: { flex: 1, paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: typography.body.fontSize },
    list: { flexGrow: 0 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
    },
    optionText: { ...typography.body, color: colors.textPrimary },
    optionTextSelected: { color: colors.teal, fontWeight: '700' },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
