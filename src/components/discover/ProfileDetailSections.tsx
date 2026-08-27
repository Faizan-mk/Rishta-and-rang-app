import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { BrowseProfile } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { SmartImage } from '../common/SmartImage';

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function IntroMediaSection({ profile }: { profile: BrowseProfile }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeIntroStyles(colors), [colors]);

  const audioPlayer = useAudioPlayer(profile.voiceIntroUri ? { uri: profile.voiceIntroUri } : undefined);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const videoPlayer = useVideoPlayer(profile.videoIntroUri ?? null, (p) => {
    p.loop = true;
  });
  const { isPlaying: videoPlaying } = useEvent(videoPlayer, 'playingChange', { isPlaying: videoPlayer.playing });

  if (!profile.voiceIntroUri && !profile.videoIntroUri) return null;

  const toggleVoice = () => {
    if (audioStatus.playing) audioPlayer.pause();
    else audioPlayer.play();
  };

  const toggleVideo = () => {
    if (videoPlaying) videoPlayer.pause();
    else videoPlayer.play();
  };

  return (
    <Section title={t('discover.introMediaTitle')}>
      {profile.voiceIntroUri && (
        <Pressable onPress={toggleVoice} style={styles.voiceCard}>
          <View style={[styles.voicePlayButton, { backgroundColor: colors.teal }]}>
            <Ionicons name={audioStatus.playing ? 'pause' : 'play'} size={16} color="#FFFFFF" />
          </View>
          <View style={styles.voiceBars} pointerEvents="none">
            {Array.from({ length: 22 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.voiceBar,
                  { height: 5 + ((i * 11) % 17), backgroundColor: colors.teal, opacity: audioStatus.playing ? 1 : 0.5 },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.voiceDuration, rtl && styles.rtlText]}>
            {formatDuration(profile.voiceIntroDurationSec ?? audioStatus.duration ?? 0)}
          </Text>
        </Pressable>
      )}

      {profile.videoIntroUri && (
        <Pressable onPress={toggleVideo} style={styles.videoWrap}>
          <VideoView player={videoPlayer} style={styles.video} contentFit="cover" nativeControls={false} />
          {!videoPlaying && (
            <View style={[StyleSheet.absoluteFill, styles.videoPlayOverlay]} pointerEvents="none">
              <Ionicons name="play-circle" size={46} color="#FFFFFF" />
            </View>
          )}
        </Pressable>
      )}
    </Section>
  );
}

export function MidProfilePhoto({ photos, onPress }: { photos: string[]; onPress?: (uri: string) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeMidPhotoStyles(colors), [colors]);
  const uri = photos?.[1];
  if (!uri) return null;

  return (
    <Pressable onPress={() => onPress?.(uri)} style={styles.wrap}>
      <SmartImage uri={uri} style={styles.image} size={48} />
      <View style={styles.badge}>
        <Ionicons name="images-outline" size={12} color="#FFFFFF" />
        <Text style={styles.badgeText}>2 / {photos.length}</Text>
      </View>
    </Pressable>
  );
}

interface AttributeChipData {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

function AttributeChip({ icon, label }: AttributeChipData) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeChipStyles(colors), [colors]);
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={15} color={colors.textSecondary} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, rtl && styles.rtlText]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

// Things the signed-in member and the profile already have in common, shown as
// the first thing under the photo because it's the best icebreaker on the screen.
export function SimilaritiesSection({ name, items }: { name: string; items: string[] }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const similarityStyles = useMemo(() => makeSimilarityStyles(colors), [colors]);

  return (
    <Section
      title={t('discover.similaritiesTitle')}
      subtitle={items.length > 0 ? t('discover.similaritiesSubtitle', { name }) : t('discover.similaritiesEmpty')}
    >
      {items.length > 0 && (
        <View style={styles.chipRow}>
          {items.map((label) => (
            <View key={label} style={similarityStyles.chip}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={[similarityStyles.chipText, rtl && styles.rtlText]}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

const READINESS_STEPS: { key: NonNullable<BrowseProfile['readiness']>; labelKey: string }[] = [
  { key: 'browsing', labelKey: 'profile.readinessBrowsing' },
  { key: 'few_months', labelKey: 'profile.readinessFewMonths' },
  { key: 'ready_now', labelKey: 'profile.readinessNow' },
];

// The roadmap's Rishta Readiness signal, drawn as a three-segment meter: how far
// along the marriage journey this member says they are.
export function ReadinessSection({ profile }: { profile: BrowseProfile }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const meter = useMemo(() => makeReadinessStyles(colors), [colors]);
  if (!profile.readiness) return null;
  const activeIndex = READINESS_STEPS.findIndex((step) => step.key === profile.readiness);

  return (
    <View style={meter.card}>
      <Text style={[meter.title, rtl && styles.rtlText]}>{t('discover.readinessTitle')}</Text>
      <Text style={[meter.caption, rtl && styles.rtlText]}>
        {t('discover.readinessCaption', { name: profile.name })}
      </Text>

      <View style={meter.segmentRow}>
        {READINESS_STEPS.map((step, i) => (
          <View key={step.key} style={[meter.segment, i <= activeIndex && meter.segmentFilled]} />
        ))}
      </View>

      <View style={meter.labelRow}>
        {READINESS_STEPS.map((step, i) => (
          <Text
            key={step.key}
            style={[meter.stepLabel, i === activeIndex && meter.stepLabelActive]}
            numberOfLines={2}
          >
            {t(step.labelKey)}
          </Text>
        ))}
      </View>

      {profile.openToRelocate && (
        <View style={[styles.chipRow, meter.chipRow]}>
          <AttributeChip icon="airplane-outline" label={t('discover.openToRelocate')} />
        </View>
      )}
    </View>
  );
}

export function AboutMeSection({ profile }: { profile: BrowseProfile }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const chips: AttributeChipData[] = [];
  if (profile.heightCm) chips.push({ icon: 'resize-outline', label: t('attributes.heightValue', { height: profile.heightCm }) });
  if (profile.maritalStatus) {
    chips.push({
      icon: 'heart-circle-outline',
      label: t(`attributes.maritalStatus${capitalize(profile.maritalStatus)}`),
    });
  }
  if (profile.hasChildren !== undefined) {
    chips.push({ icon: 'people-outline', label: t(profile.hasChildren ? 'attributes.hasChildrenYes' : 'attributes.hasChildrenNo') });
  }
  if (profile.occupation) chips.push({ icon: 'briefcase-outline', label: profile.occupation });
  if (chips.length === 0) return null;

  return (
    <Section title={t('discover.aboutMeTitle')}>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <AttributeChip key={chip.label} {...chip} />
        ))}
      </View>
    </Section>
  );
}

export function FaithSection({ profile }: { profile: BrowseProfile }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const chips: AttributeChipData[] = [];
  if (profile.religion) chips.push({ icon: 'moon-outline', label: profile.religion });
  if (profile.sect) chips.push({ icon: 'moon-outline', label: profile.sect });
  if (profile.practising !== undefined) {
    chips.push({ icon: 'moon-outline', label: t(profile.practising ? 'attributes.practisingYes' : 'attributes.practisingNo') });
  }
  if (profile.prayerHabits) chips.push({ icon: 'time-outline', label: profile.prayerHabits });
  if (profile.halalOnly) chips.push({ icon: 'restaurant-outline', label: t('attributes.halalOnly') });
  if (profile.smoking !== undefined) {
    chips.push({ icon: 'ban-outline', label: t(profile.smoking ? 'attributes.smoker' : 'attributes.nonSmoker') });
  }
  if (profile.drinking !== undefined) {
    chips.push({ icon: 'wine-outline', label: t(profile.drinking ? 'attributes.drinks' : 'attributes.doesntDrink') });
  }
  if (profile.religiousDress) chips.push({ icon: 'shirt-outline', label: profile.religiousDress });
  if (chips.length === 0) return null;

  return (
    <Section title={t('discover.faithTitle')}>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <AttributeChip key={chip.label} {...chip} />
        ))}
      </View>
    </Section>
  );
}

export function FuturePlansSection({ profile }: { profile: BrowseProfile }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const chips: AttributeChipData[] = [];
  if (profile.hasChildren === false) chips.push({ icon: 'happy-outline', label: t('attributes.hasChildrenNo') });
  if (profile.openToRelocate) chips.push({ icon: 'airplane-outline', label: t('discover.openToRelocate') });
  if (profile.preferredCountry) chips.push({ icon: 'flag-outline', label: profile.preferredCountry });
  if (profile.careerPlans) chips.push({ icon: 'trending-up-outline', label: profile.careerPlans });
  if (chips.length === 0) return null;

  return (
    <Section title={t('discover.futurePlansTitle')}>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <AttributeChip key={chip.label} {...chip} />
        ))}
      </View>
    </Section>
  );
}

// Interests fall back to the older single `vibeTags` list, so profiles created
// before the two lists were split still fill this section.
export function InterestsSection({ profile }: { profile: BrowseProfile }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const interests = profile.interests ?? profile.vibeTags ?? [];
  if (interests.length === 0) return null;

  return (
    <Section title={t('discover.interestsTitle')}>
      <View style={styles.chipRow}>
        {interests.map((label) => (
          <AttributeChip key={label} icon="sparkles-outline" label={label} />
        ))}
      </View>
    </Section>
  );
}

export function PersonalitySection({ profile }: { profile: BrowseProfile }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const traits = profile.personality ?? [];
  if (traits.length === 0) return null;

  return (
    <Section title={t('discover.personalityTitle')}>
      <View style={styles.chipRow}>
        {traits.map((label) => (
          <AttributeChip key={label} icon="happy-outline" label={label} />
        ))}
      </View>
    </Section>
  );
}

export function EducationCareerSection({ profile }: { profile: BrowseProfile }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const chips: AttributeChipData[] = [];
  if (profile.educationLevel) chips.push({ icon: 'school-outline', label: profile.educationLevel });
  if (profile.education) chips.push({ icon: 'school-outline', label: profile.education });
  if (profile.degree) chips.push({ icon: 'ribbon-outline', label: profile.degree });
  if (profile.jobTitle) chips.push({ icon: 'briefcase-outline', label: profile.jobTitle });
  if (profile.industry) chips.push({ icon: 'business-outline', label: profile.industry });
  if (chips.length === 0) return null;

  return (
    <Section title={t('discover.educationCareerTitle')}>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <AttributeChip key={chip.label} {...chip} />
        ))}
      </View>
    </Section>
  );
}

export function LanguagesBackgroundSection({ profile }: { profile: BrowseProfile }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const chips: AttributeChipData[] = [];
  (profile.languages ?? []).forEach((lang) => chips.push({ icon: 'language-outline', label: lang }));
  if (profile.nationality) chips.push({ icon: 'flag-outline', label: profile.nationality });
  if (profile.grewUpIn) chips.push({ icon: 'home-outline', label: t('discover.grewUpIn', { place: profile.grewUpIn }) });
  if (chips.length === 0) return null;

  return (
    <Section title={t('discover.languagesBackgroundTitle')}>
      <View style={styles.chipRow}>
        {chips.map((chip, i) => (
          <AttributeChip key={`${chip.label}-${i}`} {...chip} />
        ))}
      </View>
    </Section>
  );
}

export function BioSection({ profile }: { profile: BrowseProfile }) {
  const { t, rtl } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  const text = [profile.bio, profile.familyBackground].filter(Boolean).join('\n\n');
  if (!text) return null;

  return (
    <Section title={t('discover.bioTitle')}>
      <Text style={[styles.bodyText, rtl && styles.rtlText]}>{text}</Text>
    </Section>
  );
}

export function VerificationSection({ profile }: { profile: BrowseProfile }) {
  const { t, rtl } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);

  const items = [
    {
      verified: Boolean(profile.selfieVerified),
      text: profile.selfieVerified
        ? t('discover.verifiedPhotoDone', { name: profile.name })
        : t('discover.verifiedPhotoPending', { name: profile.name }),
    },
    {
      verified: Boolean(profile.bureauVerified),
      text: profile.bureauVerified
        ? t('discover.bureauDone', { name: profile.name })
        : t('discover.bureauPending', { name: profile.name }),
    },
  ];

  return (
    <View style={styles.verificationCard}>
      <View style={styles.verificationHeader}>
        <Text style={[styles.verificationTitle, rtl && styles.rtlText]}>{t('discover.verifiedProfileTitle')}</Text>
        <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
      </View>
      {items.map((item) => (
        <View key={item.text} style={styles.verificationRow}>
          <Ionicons
            name={item.verified ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={item.verified ? VERIFIED_BLUE : colors.textTertiary}
          />
          <Text style={[styles.verificationLabel, rtl && styles.rtlText]}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Verification blue reads the same in both themes, so it isn't a palette token.
const VERIFIED_BLUE = '#3B9DF8';

const makeReadinessStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.sageLight,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    title: { ...typography.h3, color: colors.textPrimary },
    caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
    segmentRow: { flexDirection: 'row', gap: 6 },
    segment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border },
    segmentFilled: { backgroundColor: colors.sage },
    labelRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
    stepLabel: { ...typography.caption, color: colors.textSecondary, flex: 1, textAlign: 'center' },
    stepLabelActive: { color: colors.sage, fontWeight: '800' },
    chipRow: { marginTop: spacing.md },
  });

const makeSimilarityStyles = (colors: Palette) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.xs + 3,
    },
    chipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  });

const makeIntroStyles = (colors: Palette) =>
  StyleSheet.create({
    voiceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    voicePlayButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    voiceBars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 },
    voiceBar: { width: 3, borderRadius: 2 },
    voiceDuration: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
    videoWrap: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
      marginTop: spacing.sm,
    },
    video: { width: '100%', height: '100%' },
    videoPlayOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,12,0.25)' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });

const makeMidPhotoStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
      marginTop: spacing.lg,
    },
    image: { width: '100%', height: '100%' },
    badge: {
      position: 'absolute',
      bottom: spacing.sm,
      right: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(10,10,12,0.55)',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    badgeText: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
  });

const makeChipStyles = (colors: Palette) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipText: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  });

const makeSectionStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginTop: spacing.lg },
    sectionTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
    sectionSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    bodyText: { ...typography.body, color: colors.textPrimary },
    verificationCard: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    verificationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    verificationTitle: { ...typography.h3, color: colors.textPrimary },
    verificationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    verificationLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
