import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../common/BottomSheet';
import { FilterSheet } from '../common/FilterSheet';
import { SettingsRow } from '../common/SettingsRow';
import { SelectField } from '../common/SelectField';
import { PAKISTAN_CITIES } from '../../data/locations';
import { SECT_OPTIONS } from '../../data/sects';
import type { Intent, ProfileMode, RishtaReadiness } from '../../types/user';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import {
  AGE_CEILING,
  AGE_FLOOR,
  DEFAULT_BROWSE_FILTERS,
  INTENT_OPTIONS,
  READINESS_OPTIONS,
  SORT_OPTIONS,
  type BrowseFilters,
  type BrowseSortKey,
} from './browseOptions';

interface BrowseFiltersSheetProps {
  visible: boolean;
  filters: BrowseFilters;
  // Sect and readiness only apply to the matrimonial deck.
  mode: ProfileMode;
  onChange: (filters: BrowseFilters) => void;
  onClose: () => void;
}

// The roadmap's V1 manual filters: age, city, intent, and (matrimonial only)
// sect and readiness, plus the two trust/activity switches this app adds.
export function BrowseFiltersSheet({ visible, filters, mode, onChange, onClose }: BrowseFiltersSheetProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <FilterSheet
      visible={visible}
      title={t('discover.filtersTitle')}
      onClose={onClose}
      onApply={onClose}
      onReset={() => onChange(DEFAULT_BROWSE_FILTERS)}
    >
      <AgeRangeRow
        min={filters.ageMin}
        max={filters.ageMax}
        onChange={(ageMin, ageMax) => onChange({ ...filters, ageMin, ageMax })}
      />

      <SelectField
        label={t('discover.filterCity')}
        value={filters.city}
        options={PAKISTAN_CITIES}
        onChange={(city) => onChange({ ...filters, city })}
        allowAll
        allLabel={t('discover.filterAnyCity')}
      />

      <Text style={styles.groupLabel}>{t('discover.filterIntent')}</Text>
      <View style={styles.readinessRow}>
        <ReadinessChip
          label={t('discover.filterAnyIntent')}
          selected={filters.intent === null}
          onPress={() => onChange({ ...filters, intent: null })}
          colors={colors}
        />
        {INTENT_OPTIONS.map((option) => (
          <ReadinessChip
            key={option.key}
            label={t(option.labelKey)}
            selected={filters.intent === option.key}
            onPress={() => onChange({ ...filters, intent: option.key as Intent })}
            colors={colors}
          />
        ))}
      </View>

      {mode === 'rishta' && (
        <>
          <SelectField
            label={t('discover.filterSect')}
            value={filters.sect}
            options={SECT_OPTIONS}
            onChange={(sect) => onChange({ ...filters, sect })}
            allowAll
            allLabel={t('discover.filterAnySect')}
          />

          <Text style={styles.groupLabel}>{t('discover.filterReadiness')}</Text>
          <View style={styles.readinessRow}>
            <ReadinessChip
              label={t('discover.filterAnyReadiness')}
              selected={filters.readiness === null}
              onPress={() => onChange({ ...filters, readiness: null })}
              colors={colors}
            />
            {READINESS_OPTIONS.map((option) => (
              <ReadinessChip
                key={option.key}
                label={t(option.labelKey)}
                selected={filters.readiness === option.key}
                onPress={() => onChange({ ...filters, readiness: option.key as RishtaReadiness })}
                colors={colors}
              />
            ))}
          </View>
        </>
      )}

      <SettingsRow
        icon="shield-checkmark-outline"
        label={t('discover.filterVerifiedOnly')}
        right="switch"
        switchValue={filters.verifiedOnly}
        onSwitchChange={(verifiedOnly) => onChange({ ...filters, verifiedOnly })}
      />
      <SettingsRow
        icon="time-outline"
        label={t('discover.filterActiveToday')}
        right="switch"
        switchValue={filters.activeToday}
        onSwitchChange={(activeToday) => onChange({ ...filters, activeToday })}
      />
    </FilterSheet>
  );
}

// Two steppers rather than a slider: no extra dependency, and precise on a phone.
function AgeRangeRow({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.ageBlock}>
      <View style={styles.ageHeader}>
        <Text style={styles.groupLabel}>{t('discover.filterAge')}</Text>
        <Text style={styles.ageValue}>{t('discover.filterAgeRange', { min, max })}</Text>
      </View>
      <View style={styles.ageRow}>
        <Stepper
          label={t('discover.filterAgeMin')}
          value={min}
          onDecrease={() => onChange(Math.max(AGE_FLOOR, min - 1), max)}
          onIncrease={() => onChange(Math.min(max, min + 1), max)}
          colors={colors}
        />
        <Stepper
          label={t('discover.filterAgeMax')}
          value={max}
          onDecrease={() => onChange(min, Math.max(min, max - 1))}
          onIncrease={() => onChange(min, Math.min(AGE_CEILING, max + 1))}
          colors={colors}
        />
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  colors,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  colors: Palette;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={onDecrease} hitSlop={6} style={styles.stepperButton}>
          <Ionicons name="remove" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable onPress={onIncrease} hitSlop={6} style={styles.stepperButton}>
          <Ionicons name="add" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function ReadinessChip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: Palette;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={[styles.readinessChip, selected && styles.readinessChipSelected]}>
      <Text style={[styles.readinessChipText, selected && styles.readinessChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

interface BrowseSortSheetProps {
  visible: boolean;
  sort: BrowseSortKey;
  onChange: (sort: BrowseSortKey) => void;
  onClose: () => void;
}

// Full-height "Sort by" sheet: pick a row, then Confirm. Closing with the X
// leaves the deck on whatever sort it already had.
export function BrowseSortSheet({ visible, sort, onChange, onClose }: BrowseSortSheetProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Draft selection — nothing reaches the deck until Confirm.
  const [draft, setDraft] = useState<BrowseSortKey>(sort);

  useEffect(() => {
    if (visible) setDraft(sort);
  }, [visible, sort]);

  const onConfirm = () => {
    onChange(draft);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height="90%" showHandle={false}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('discover.sortTitle')}</Text>
        {/* Balances the close button so the title stays centred. */}
        <View style={styles.closeButton} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SORT_OPTIONS.map((option) => {
          const selected = option.key === draft;
          return (
            <Pressable
              key={option.key}
              onPress={() => setDraft(option.key)}
              style={[styles.option, rtl && styles.optionRtl]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected, rtl && styles.rtlText]}>
                {t(option.labelKey)}
              </Text>
              {selected && <Ionicons name="checkmark" size={20} color={colors.teal} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onConfirm} style={styles.confirmButton}>
          <Text style={styles.confirmLabel}>{t('common.confirm')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Filters
    groupLabel: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '700' },
    ageBlock: { marginBottom: spacing.md },
    ageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    ageValue: { ...typography.label, color: colors.teal, fontWeight: '800' },
    ageRow: { flexDirection: 'row', gap: spacing.sm },
    stepper: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
    },
    stepperLabel: { ...typography.caption, color: colors.textSecondary },
    stepperControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    stepperButton: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: withAlpha(colors.teal, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: { ...typography.h3, color: colors.textPrimary, fontWeight: '800' },
    readinessRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    readinessChip: {
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    readinessChipSelected: {
      backgroundColor: withAlpha(colors.teal, 0.14),
      borderColor: colors.teal,
      ...glow(colors.teal, 0.3, 10, 4),
    },
    readinessChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
    readinessChipTextSelected: { color: colors.teal, fontWeight: '800' },

    // Sort sheet
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
    closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { ...typography.h2, color: colors.textPrimary, flex: 1, textAlign: 'center', fontWeight: '800' },
    list: { paddingBottom: spacing.lg },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
    },
    optionRtl: { flexDirection: 'row-reverse' },
    optionLabel: { ...typography.h3, color: colors.textPrimary, fontWeight: '600', flexShrink: 1 },
    optionLabelSelected: { color: colors.teal, fontWeight: '800' },
    footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
    confirmButton: {
      backgroundColor: colors.teal,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      minHeight: 52,
      ...glow(colors.teal, 0.5, 16, 7),
    },
    confirmLabel: { ...typography.h3, color: '#FFFFFF', fontWeight: '800' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
