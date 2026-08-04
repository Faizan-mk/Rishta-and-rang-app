import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { MainTabScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { RishtaListingCard } from '../../components/rishta/RishtaListingCard';
import { FilterSheet } from '../../components/common/FilterSheet';
import { SelectField } from '../../components/common/SelectField';
import { Chip } from '../../components/common/Chip';
import { IconButton } from '../../components/common/IconButton';
import { mockRishtaProfiles } from '../../data/mockRishta';
import { PAKISTAN_CITIES } from '../../data/locations';
import { SECT_OPTIONS } from '../../data/sects';
import type { RishtaListingProfile } from '../../types/content';
import type { RishtaReadiness } from '../../types/user';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useAuth } from '../../store/AuthContext';
import { useFavorites } from '../../store/FavoritesContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = MainTabScreenProps<'Rishta'>;

type AgeBucket = 'all' | '20-25' | '26-30' | '31+';

function matchesAgeBucket(age: number, bucket: AgeBucket): boolean {
  if (bucket === 'all') return true;
  if (bucket === '20-25') return age <= 25;
  if (bucket === '26-30') return age >= 26 && age <= 30;
  return age >= 31;
}

const AGE_OPTIONS: { key: AgeBucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '20-25', label: '20-25' },
  { key: '26-30', label: '26-30' },
  { key: '31+', label: '31+' },
];

const READINESS_OPTIONS: { key: 'all' | RishtaReadiness; labelKey: string }[] = [
  { key: 'all', labelKey: 'common.reset' },
  { key: 'ready_now', labelKey: 'profile.readinessNow' },
  { key: 'few_months', labelKey: 'profile.readinessFewMonths' },
  { key: 'browsing', labelKey: 'profile.readinessBrowsing' },
];

export function RishtaScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  const eligibleProfiles = useMemo(
    () => oppositeGenderProfiles(mockRishtaProfiles, user?.gender),
    [user?.gender]
  );

  // Applied filters (drive the list)
  const [ageBucket, setAgeBucket] = useState<AgeBucket>('all');
  const [sect, setSect] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<'all' | RishtaReadiness>('all');
  const [city, setCity] = useState<string | null>(null);

  // Draft filters (edited inside the sheet, committed on Apply)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftAge, setDraftAge] = useState<AgeBucket>('all');
  const [draftSect, setDraftSect] = useState<string | null>(null);
  const [draftReadiness, setDraftReadiness] = useState<'all' | RishtaReadiness>('all');
  const [draftCity, setDraftCity] = useState<string | null>(null);

  const openSheet = () => {
    setDraftAge(ageBucket);
    setDraftSect(sect);
    setDraftReadiness(readiness);
    setDraftCity(city);
    setSheetOpen(true);
  };

  const applyFilters = () => {
    setAgeBucket(draftAge);
    setSect(draftSect);
    setReadiness(draftReadiness);
    setCity(draftCity);
    setSheetOpen(false);
  };

  const resetFilters = () => {
    setDraftAge('all');
    setDraftSect(null);
    setDraftReadiness('all');
    setDraftCity(null);
  };

  const activeFilterCount = [ageBucket !== 'all', Boolean(sect), readiness !== 'all', Boolean(city)].filter(Boolean).length;

  const filtered = useMemo(() => {
    return eligibleProfiles.filter(
      (p) =>
        matchesAgeBucket(p.age, ageBucket) &&
        (!sect || p.sect === sect) &&
        (readiness === 'all' || p.readiness === readiness) &&
        (!city || p.city === city)
    );
  }, [eligibleProfiles, ageBucket, sect, readiness, city]);

  const renderItem = ({ item, index }: { item: RishtaListingProfile; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 60, 300)).duration(360)}>
      <RishtaListingCard
        profile={item}
        liked={isFavorite(item.id)}
        onPress={() => navigation.navigate('ProfileDetail', { kind: 'rishta', id: item.id })}
        onToggleLike={() =>
          toggleFavorite({ id: item.id, kind: 'rishta', name: item.name, age: item.age, city: item.city, photo: item.photos[0] })
        }
      />
    </Animated.View>
  );

  return (
    <ScreenContainer scroll={false} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, rtl && styles.rtlText]}>{t('rishtaBrowse.title')}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('rishtaBrowse.subtitle')}</Text>
        </View>
        <IconButton icon="options-outline" onPress={openSheet} badge={activeFilterCount} background={colors.surface} />
      </View>

      <Text style={[styles.resultsCount, rtl && styles.rtlText]}>{t('rishtaBrowse.resultsCount', { count: filtered.length })}</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={32} color={colors.textTertiary} />
            <Text style={[styles.emptyText, rtl && styles.rtlText]}>{t('rishtaBrowse.empty')}</Text>
          </View>
        }
      />

      <FilterSheet
        visible={sheetOpen}
        title={t('rishtaBrowse.filters')}
        onClose={() => setSheetOpen(false)}
        onApply={applyFilters}
        onReset={resetFilters}
      >
        <Text style={[styles.sheetLabel, rtl && styles.rtlText]}>{t('rishtaBrowse.ageRange')}</Text>
        <View style={styles.chipRow}>
          {AGE_OPTIONS.map((option) => (
            <Chip key={option.key} label={option.label} tone="rishta" selected={draftAge === option.key} onPress={() => setDraftAge(option.key)} />
          ))}
        </View>

        <Text style={[styles.sheetLabel, rtl && styles.rtlText]}>{t('rishtaBrowse.readiness')}</Text>
        <View style={styles.chipRow}>
          {READINESS_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={option.key === 'all' ? 'All' : t(option.labelKey)}
              tone="rishta"
              selected={draftReadiness === option.key}
              onPress={() => setDraftReadiness(option.key)}
            />
          ))}
        </View>

        <Text style={[styles.sheetLabel, rtl && styles.rtlText]}>{t('rishtaBrowse.sect')}</Text>
        <View style={styles.chipRow}>
          <Chip label="All" tone="rishta" selected={!draftSect} onPress={() => setDraftSect(null)} />
          {SECT_OPTIONS.map((option) => (
            <Chip key={option} label={option} tone="rishta" selected={draftSect === option} onPress={() => setDraftSect(option)} />
          ))}
        </View>

        <SelectField
          label={t('rishtaBrowse.city')}
          value={draftCity}
          options={PAKISTAN_CITIES}
          onChange={setDraftCity}
          allowAll
          allLabel="All cities"
        />
      </FilterSheet>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
    headerText: { flex: 1 },
    title: { ...typography.h1, color: colors.textPrimary },
    subtitle: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
    resultsCount: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
    listContent: { paddingBottom: spacing.xl },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl, gap: spacing.md },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    sheetLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
