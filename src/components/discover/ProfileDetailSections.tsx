import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { BrowseProfile } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

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
      <Image source={{ uri }} style={styles.image} />
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
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{title}</Text>
      {children}
    </View>
  );
}

const READINESS_STEPS: { key: NonNullable<BrowseProfile['readiness']>; labelKey: string }[] = [
  { key: 'browsing', labelKey: 'profile.readinessBrowsing' },
  { key: 'few_months', labelKey: 'profile.readinessFewMonths' },
  { key: 'ready_now', labelKey: 'profile.readinessNow' },
];

export function MarriageIntentionsCard({ profile }: { profile: BrowseProfile }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);
  if (!profile.readiness) return null;
  const activeIndex = READINESS_STEPS.findIndex((s) => s.key === profile.readiness);

  return (
    <Section title={t('discover.marriageIntentionsTitle')}>
      <View style={intentionStyles.track}>
        <View style={[intentionStyles.trackFill, { width: `${(activeIndex / (READINESS_STEPS.length - 1)) * 100}%`, backgroundColor: colors.rishta }]} />
        {READINESS_STEPS.map((step, i) => (
          <View
            key={step.key}
            style={[
              intentionStyles.dot,
              { left: `${(i / (READINESS_STEPS.length - 1)) * 100}%`, backgroundColor: i <= activeIndex ? colors.rishta : colors.border },
            ]}
          />
        ))}
      </View>
      <View style={intentionStyles.labelRow}>
        {READINESS_STEPS.map((step, i) => (
          <Text
            key={step.key}
            style={[
              intentionStyles.label,
              { color: i === activeIndex ? colors.rishta : colors.textTertiary, fontWeight: i === activeIndex ? '700' : '400' },
              rtl && styles.rtlText,
            ]}
          >
            {t(step.labelKey)}
          </Text>
        ))}
      </View>
      {profile.openToRelocate !== undefined && (
        <View style={styles.chipRow}>
          {profile.openToRelocate && <AttributeChip icon="airplane-outline" label={t('discover.openToRelocate')} />}
        </View>
      )}
    </Section>
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

export function VerificationSection({ profile }: { profile: BrowseProfile }) {
  const { t, rtl } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => makeSectionStyles(colors), [colors]);

  const items: { icon: keyof typeof Ionicons.glyphMap; label: string; verified: boolean }[] = [
    { icon: 'person-circle-outline', label: t('profile.verified'), verified: Boolean(profile.selfieVerified) },
    { icon: 'shield-checkmark-outline', label: t('profile.bureau'), verified: Boolean(profile.bureauVerified) },
  ];

  return (
    <Section title={t('discover.verificationTitle')}>
      <View style={styles.verificationCard}>
        {items.map((item, i) => (
          <View key={item.label} style={[styles.verificationRow, i > 0 && styles.verificationRowBorder]}>
            <Ionicons name={item.icon} size={18} color={item.verified ? colors.success : colors.textTertiary} />
            <Text style={[styles.verificationLabel, rtl && styles.rtlText]}>{item.label}</Text>
            <Ionicons
              name={item.verified ? 'checkmark-circle' : 'close-circle-outline'}
              size={18}
              color={item.verified ? colors.success : colors.textTertiary}
            />
          </View>
        ))}
      </View>
    </Section>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const intentionStyles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: spacing.md, marginHorizontal: 6, position: 'relative' },
  trackFill: { position: 'absolute', height: 4, borderRadius: 2, top: 0, left: 0 },
  dot: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  label: { ...typography.caption, flexShrink: 1, textAlign: 'center' },
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 2,
    },
    chipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  });

const makeSectionStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginTop: spacing.lg },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    verificationCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    verificationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    verificationRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
    verificationLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
