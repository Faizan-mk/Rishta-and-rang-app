import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterSheet } from '../common/FilterSheet';
import { SettingsRow } from '../common/SettingsRow';
import { SelectField } from '../common/SelectField';
import { PAKISTAN_CITIES } from '../../data/locations';
import { SECT_OPTIONS } from '../../data/sects';
import type { Intent, ProfileMode, RishtaReadiness } from '../../types/user';
import { fonts, radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import {
  AGE_CEILING,
  AGE_FLOOR,
  DEFAULT_BROWSE_FILTERS,
  INTENT_OPTIONS,
  READINESS_OPTIONS,
  type BrowseFilters,
} from './browseOptions';

interface BrowseFiltersSheetProps {
  visible: boolean;
  filters: BrowseFilters;
  // Sect and readiness only apply to the matrimonial deck. Without a mode
  // (Home's mixed deck) they are always offered.
  mode?: ProfileMode;
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
        allowCustom
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

      {mode !== 'dating' && (
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

      {/* A selfie taken at signup, not a check of anyone's identity — so the
          row says what it filters on and does not wear a "verified" shield. */}
      <SettingsRow
        icon="camera-outline"
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Filters
    groupLabel: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs, fontFamily: fonts.bodyBold },
    ageBlock: { marginBottom: spacing.md },
    ageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    ageValue: { ...typography.label, color: colors.teal, fontFamily: fonts.bodyBold },
    ageRow: { flexDirection: 'row', gap: spacing.sm },
    stepper: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderRadius: radius.pill,
      backgroundColor: colors.tealSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: { ...typography.h3, color: colors.textPrimary },
    readinessRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    readinessChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    readinessChipSelected: {
      backgroundColor: colors.tealSoft,
      borderColor: colors.teal,
    },
    readinessChipText: { ...typography.caption, color: colors.textSecondary, fontFamily: fonts.bodyBold },
    readinessChipTextSelected: { color: colors.teal, fontFamily: fonts.bodyBold },
  });
