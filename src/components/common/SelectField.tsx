import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { vocabularyLabel } from '../../i18n/vocabulary';

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
    const needle = query.trim().toLowerCase();
    const list = needle
      ? options.filter(
          (o) => o.toLowerCase().includes(needle) || vocabularyLabel(o, t).toLowerCase().includes(needle)
        )
      : options;
    return allowAll ? [allLabel ?? 'All', ...list] : list;
  }, [options, query, allowAll, allLabel, t]);

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
      <Pressable onPress={() => setOpen(true)} style={[styles.field, rtl && styles.rowRtl, error && styles.fieldError]}>
        <Text style={[styles.value, !displayValue && styles.placeholder, rtl && styles.rtlText]}>
          {displayValue ? vocabularyLabel(displayValue, t) : placeholder ?? '—'}
        </Text>
        <View style={styles.chevronTile}>
          <Ionicons name="chevron-down" size={16} color={colors.teal} />
        </View>
      </Pressable>
      {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetTitle, rtl && styles.rtlText]}>{label}</Text>
          <View style={[styles.searchRow, rtl && styles.rowRtl]}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('common.search')}
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
                <Pressable onPress={() => select(item)} style={[styles.option, rtl && styles.rowRtl]}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected, rtl && styles.rtlText]}>
                    {vocabularyLabel(item, t)}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.teal} />}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>{t('common.noResults')}</Text>}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { marginBottom: spacing.md },
    // The chevron, the search icon and the tick all move to the edge the
    // language starts at, so none of them lands mid-sentence in Urdu.
    rowRtl: { flexDirection: 'row-reverse' },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '700' },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.surface,
    },
    chevronTile: {
      width: 26,
      height: 26,
      borderRadius: radius.sm,
      backgroundColor: withAlpha(colors.teal, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldError: { borderColor: colors.danger },
    value: { ...typography.body, color: colors.textPrimary },
    placeholder: { color: colors.textTertiary },
    errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
    // The panel itself (backdrop, rounded top, handle, slide) is BottomSheet's.
    sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
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
    optionTextSelected: { color: colors.teal, fontWeight: '800' },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
