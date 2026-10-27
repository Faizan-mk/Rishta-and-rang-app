import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterSheet } from '../common/FilterSheet';
import { SettingsRow } from '../common/SettingsRow';
import { SelectField } from '../common/SelectField';
import { PAKISTAN_CITIES } from '../../data/locations';
import { SECT_OPTIONS } from '../../data/sects';
import { EDUCATION_LEVELS, JOB_TITLES, NATIONALITIES, PAKISTANI_LANGUAGES } from '../../data/profileOptions';
import type { Intent, ProfileMode, RishtaReadiness } from '../../types/user';
import { fonts, radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import {
  AGE_CEILING,
  AGE_FLOOR,
  DEFAULT_BROWSE_FILTERS,
  HEIGHT_CEILING_CM,
  HEIGHT_FLOOR_CM,
  HEIGHT_STEP_CM,
  INTENT_OPTIONS,
  MARITAL_OPTIONS,
  READINESS_OPTIONS,
  SORT_OPTIONS,
  type BrowseSort,
  feetInches,
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

// The roadmap's V1 manual filters (age, city, intent, and matrimonial-only
// sect and readiness), the trust/activity switches this app adds and the
// matrimonial basics, grouped the way rishta apps group them: basics, education
// and career, future plans, deen, activity. The sort has its own sheet, below.
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
      <SectionTitle title={t('discover.filterSectionBasics')} styles={styles} />
      <RangeRow
        label={t('discover.filterAge')}
        value={t('discover.filterAgeRange', { min: filters.ageMin, max: filters.ageMax })}
        min={filters.ageMin}
        max={filters.ageMax}
        floor={AGE_FLOOR}
        ceiling={AGE_CEILING}
        step={1}
        onChange={(ageMin, ageMax) => onChange({ ...filters, ageMin, ageMax })}
      />

      <RangeRow
        label={t('discover.filterHeight')}
        value={
          filters.heightMin === HEIGHT_FLOOR_CM && filters.heightMax === HEIGHT_CEILING_CM
            ? t('discover.filterAnyHeight')
            : `${feetInches(filters.heightMin)} – ${feetInches(filters.heightMax)}`
        }
        min={filters.heightMin}
        max={filters.heightMax}
        floor={HEIGHT_FLOOR_CM}
        ceiling={HEIGHT_CEILING_CM}
        step={HEIGHT_STEP_CM}
        format={feetInches}
        onChange={(heightMin, heightMax) => onChange({ ...filters, heightMin, heightMax })}
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

      <SelectField
        label={t('discover.filterNationality')}
        value={filters.nationality}
        options={NATIONALITIES}
        onChange={(nationality) => onChange({ ...filters, nationality })}
        allowAll
        allLabel={t('discover.filterAnyNationality')}
      />

      <SelectField
        label={t('discover.filterLanguage')}
        value={filters.language}
        options={PAKISTANI_LANGUAGES}
        onChange={(language) => onChange({ ...filters, language })}
        allowAll
        allLabel={t('discover.filterAnyLanguage')}
      />

      <Text style={styles.groupLabel}>{t('discover.filterMarital')}</Text>
      <View style={styles.readinessRow}>
        <ReadinessChip
          label={t('discover.filterAnyMarital')}
          selected={filters.maritalStatus === null}
          onPress={() => onChange({ ...filters, maritalStatus: null })}
          colors={colors}
        />
        {MARITAL_OPTIONS.map((option) => (
          <ReadinessChip
            key={option.key}
            label={t(option.labelKey)}
            selected={filters.maritalStatus === option.key}
            onPress={() => onChange({ ...filters, maritalStatus: option.key })}
            colors={colors}
          />
        ))}
      </View>

      <SettingsRow
        icon="people-outline"
        label={t('discover.filterNoChildren')}
        right="switch"
        switchValue={filters.noChildren}
        onSwitchChange={(noChildren) => onChange({ ...filters, noChildren })}
      />

      <SectionTitle title={t('discover.filterSectionCareer')} styles={styles} />
      <SelectField
        label={t('discover.filterEducation')}
        value={filters.education}
        options={EDUCATION_LEVELS}
        onChange={(education) => onChange({ ...filters, education })}
        allowAll
        allLabel={t('discover.filterAnyEducation')}
      />

      <SelectField
        label={t('discover.filterJobTitle')}
        value={filters.jobTitle}
        options={JOB_TITLES}
        onChange={(jobTitle) => onChange({ ...filters, jobTitle })}
        allowAll
        allLabel={t('discover.filterAnyJobTitle')}
      />

      <SectionTitle title={t('discover.filterSectionFuture')} styles={styles} />
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
        icon="airplane-outline"
        label={t('discover.filterRelocate')}
        right="switch"
        switchValue={filters.openToRelocate}
        onSwitchChange={(openToRelocate) => onChange({ ...filters, openToRelocate })}
      />

      <SectionTitle title={t('discover.filterSectionDeen')} styles={styles} />
      {mode !== 'dating' && (
        <SelectField
          label={t('discover.filterSect')}
          value={filters.sect}
          options={SECT_OPTIONS}
          onChange={(sect) => onChange({ ...filters, sect })}
          allowAll
          allLabel={t('discover.filterAnySect')}
        />
      )}
      <SettingsRow
        icon="moon-outline"
        label={t('discover.filterPractising')}
        right="switch"
        switchValue={filters.practisingOnly}
        onSwitchChange={(practisingOnly) => onChange({ ...filters, practisingOnly })}
      />
      <SettingsRow
        icon="restaurant-outline"
        label={t('discover.filterHalalOnly')}
        right="switch"
        switchValue={filters.halalOnly}
        onSwitchChange={(halalOnly) => onChange({ ...filters, halalOnly })}
      />
      <SettingsRow
        icon="wine-outline"
        label={t('discover.filterNonDrinkers')}
        right="switch"
        switchValue={filters.nonDrinkersOnly}
        onSwitchChange={(nonDrinkersOnly) => onChange({ ...filters, nonDrinkersOnly })}
      />
      <SettingsRow
        icon="leaf-outline"
        label={t('discover.filterNonSmokers')}
        right="switch"
        switchValue={filters.nonSmokersOnly}
        onSwitchChange={(nonSmokersOnly) => onChange({ ...filters, nonSmokersOnly })}
      />

      <SectionTitle title={t('discover.filterSectionActivity')} styles={styles} />
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
      <SettingsRow
        icon="radio-button-on-outline"
        label={t('discover.filterOnlineNow')}
        right="switch"
        switchValue={filters.onlineNow}
        onSwitchChange={(onlineNow) => onChange({ ...filters, onlineNow })}
      />
    </FilterSheet>
  );
}

function SectionTitle({ title, styles }: { title: string; styles: ReturnType<typeof makeStyles> }) {
  const { rtl } = useLanguage();
  return <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{title}</Text>;
}

// Home's sort button. Picking an order applies it and closes the sheet: one
// choice, nothing to combine, so no separate Apply step to remember.
export function BrowseSortSheet({
  visible,
  sort,
  onChange,
  onClose,
}: {
  visible: boolean;
  sort: BrowseSort;
  onChange: (sort: BrowseSort) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <FilterSheet
      visible={visible}
      title={t('discover.sortBy')}
      onClose={onClose}
      onApply={onClose}
      onReset={() => onChange(DEFAULT_BROWSE_FILTERS.sort)}
    >
      {SORT_OPTIONS.map((option) => {
        const selected = sort === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => {
              onChange(option.key);
              onClose();
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.sortRow, selected && styles.sortRowSelected, rtl && styles.rowRtl]}
          >
            <Text style={[styles.sortLabel, selected && styles.sortLabelSelected]}>{t(option.labelKey)}</Text>
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={selected ? colors.teal : colors.textTertiary}
            />
          </Pressable>
        );
      })}
    </FilterSheet>
  );
}

// Two steppers rather than a slider: no extra dependency, and precise on a phone.
function RangeRow({
  label,
  value,
  min,
  max,
  floor,
  ceiling,
  step,
  format = String,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  floor: number;
  ceiling: number;
  step: number;
  format?: (n: number) => string;
  onChange: (min: number, max: number) => void;
}) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.ageBlock}>
      <View style={styles.ageHeader}>
        <Text style={styles.groupLabel}>{label}</Text>
        <Text style={styles.ageValue}>{value}</Text>
      </View>
      <View style={styles.ageRow}>
        <Stepper
          label={t('discover.filterAgeMin')}
          value={format(min)}
          onDecrease={() => onChange(Math.max(floor, min - step), max)}
          onIncrease={() => onChange(Math.min(max, min + step), max)}
          colors={colors}
        />
        <Stepper
          label={t('discover.filterAgeMax')}
          value={format(max)}
          onDecrease={() => onChange(min, Math.max(min, max - step))}
          onIncrease={() => onChange(min, Math.min(ceiling, max + step))}
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
  value: string;
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
    sectionTitle: {
      ...typography.label,
      color: colors.teal,
      fontFamily: fonts.bodyBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
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
    // Sort
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
    },
    sortRowSelected: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
    sortLabel: { ...typography.body, color: colors.textPrimary },
    sortLabelSelected: { color: colors.teal, fontFamily: fonts.bodyBold },
    rowRtl: { flexDirection: 'row-reverse' },
  });
