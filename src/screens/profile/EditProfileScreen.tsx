import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEvent } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { Button } from '../../components/Button';
import { Chip } from '../../components/common/Chip';
import { FadeIn } from '../../components/common/FadeInUp';
import { PAKISTAN_CITIES } from '../../data/locations';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { usePrivacy } from '../../store/PrivacyContext';
import type { UserProfile } from '../../types/user';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

const MAX_PHOTOS = 4;
const MARITAL_OPTIONS: NonNullable<UserProfile['maritalStatus']>[] = ['single', 'divorced', 'widowed'];
const OTHER_OPTION = 'Other';
const EDUCATION_LEVEL_OPTIONS = ['Matric / O-Level', 'Intermediate / A-Level', 'Bachelor\'s', 'Master\'s', 'MPhil', 'PhD', 'Diploma', 'Religious education', OTHER_OPTION];
const DEGREE_OPTIONS = ['BA', 'B.Com', 'BBA', 'BS Computer Science', 'BS Engineering', 'LLB', 'MBBS', 'BDS', 'MA', 'M.Com', 'MBA', 'MS / MPhil', 'PhD', 'Other'];
const JOB_TITLE_OPTIONS = ['Student', 'Software Engineer', 'Doctor', 'Engineer', 'Teacher', 'Business Owner', 'Banker', 'Lawyer', 'Government Officer', 'Healthcare Professional', 'Armed Forces', 'Homemaker', 'Retired', 'Other'];
const INDUSTRY_OPTIONS = ['Information Technology', 'Healthcare', 'Education', 'Finance and Banking', 'Engineering', 'Law', 'Government', 'Business and Trade', 'Telecommunications', 'Manufacturing', 'Media and Marketing', 'Real Estate', 'Agriculture', 'Other'];
const PAKISTANI_LANGUAGE_OPTIONS = ['Urdu', 'English', 'Punjabi', 'Sindhi', 'Pashto', 'Balochi', 'Saraiki', 'Hindko', 'Kashmiri', 'Arabic', OTHER_OPTION];
const NATIONALITY_OPTIONS = ['Pakistani', 'Dual nationality', OTHER_OPTION];
const COUNTRY_OPTIONS = ['Pakistan', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'United Kingdom', 'United States', 'Canada', 'Australia', OTHER_OPTION];

type DetailsState = {
  heightCm: string;
  maritalStatus?: UserProfile['maritalStatus'];
  hasChildren?: boolean;
  occupation: string;
  practising?: boolean;
  prayerHabits: string;
  halalOnly?: boolean;
  smoking?: boolean;
  drinking?: boolean;
  religiousDress: string;
  openToRelocate?: boolean;
  preferredCountry: string;
  careerPlans: string;
  educationLevel: string;
  degree: string;
  jobTitle: string;
  industry: string;
  languagesText: string;
  nationality: string;
  grewUpIn: string;
  country: string;
};

function initDetails(user: UserProfile | null): DetailsState {
  return {
    heightCm: user?.heightCm ? String(user.heightCm) : '',
    maritalStatus: user?.maritalStatus,
    hasChildren: user?.hasChildren,
    occupation: user?.occupation ?? '',
    practising: user?.practising,
    prayerHabits: user?.prayerHabits ?? '',
    halalOnly: user?.halalOnly,
    smoking: user?.smoking,
    drinking: user?.drinking,
    religiousDress: user?.religiousDress ?? '',
    openToRelocate: user?.openToRelocate,
    preferredCountry: user?.preferredCountry ?? '',
    careerPlans: user?.careerPlans ?? '',
    educationLevel: user?.educationLevel ?? '',
    degree: user?.degree ?? '',
    jobTitle: user?.jobTitle ?? '',
    industry: user?.industry ?? '',
    languagesText: (user?.languages ?? []).join(', '),
    nationality: user?.nationality ?? '',
    grewUpIn: user?.grewUpIn ?? '',
    country: user?.country ?? '',
  };
}

export function EditProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser } = useAuth();
  const { notify } = useDialog();
  const { prefs } = usePrivacy();

  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCity] = useState<string | null>(user?.city || null);
  const [photos, setPhotos] = useState<string[]>(user?.photos ?? []);
  const [vibeTags, setVibeTags] = useState<string[]>(user?.dating.vibeTags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [details, setDetails] = useState<DetailsState>(() => initDetails(user));
  const [saving, setSaving] = useState(false);

  const [voiceUri, setVoiceUri] = useState<string | undefined>(user?.voiceIntroUri);
  const [voiceDuration, setVoiceDuration] = useState<number | undefined>(user?.voiceIntroDurationSec);
  const [videoUri, setVideoUri] = useState<string | undefined>(user?.videoIntroUri);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const voicePlayer = useAudioPlayer(voiceUri ? { uri: voiceUri } : undefined);
  const voiceStatus = useAudioPlayerStatus(voicePlayer);
  const videoPlayer = useVideoPlayer(videoUri ?? null, (p) => {
    p.loop = true;
  });
  const { isPlaying: videoPlaying } = useEvent(videoPlayer, 'playingChange', { isPlaying: videoPlayer.playing });

  if (!user) return null;

  const accent = modeAccent(colors, user.activeMode);
  // Unselected photo tiles get a hairline rim rather than the member's colours.
  const idleRim = [colors.border, colors.borderSoft] as const;

  const startVoiceRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.microphoneTitle'), message: t('permissions.microphoneBody') });
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const stopVoiceRecording = async () => {
    if (!recording) return;
    const durationSec = recorder.currentTime;
    await recorder.stop();
    setRecording(false);
    if (recorder.uri && durationSec >= 1) {
      setVoiceUri(recorder.uri);
      setVoiceDuration(durationSec);
    }
  };

  const removeVoiceIntro = () => {
    setVoiceUri(undefined);
    setVoiceDuration(undefined);
  };

  const toggleVoicePreview = () => {
    if (voiceStatus.playing) voicePlayer.pause();
    else voicePlayer.play();
  };

  const pickVideoIntro = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.photoLibraryTitle'), message: t('permissions.photoLibraryBody') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.7, videoMaxDuration: 30 });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const removeVideoIntro = () => setVideoUri(undefined);

  const toggleVideoPreview = () => {
    if (videoPlaying) videoPlayer.pause();
    else videoPlayer.play();
  };

  const setField = <K extends keyof DetailsState>(key: K, value: DetailsState[K]) =>
    setDetails((prev) => ({ ...prev, [key]: value }));

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.photoLibraryTitle'), message: t('permissions.photoLibraryBody') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p !== uri));
  const setPrimaryPhoto = (uri: string) => setPhotos((prev) => [uri, ...prev.filter((p) => p !== uri)]);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || vibeTags.includes(trimmed)) return;
    setVibeTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setVibeTags((prev) => prev.filter((t2) => t2 !== tag));

  const onSave = async () => {
    setSaving(true);
    const heightParsed = Number(details.heightCm);
    await updateUser({
      ...user,
      bio,
      city: city ?? '',
      photos,
      dating: { ...user.dating, vibeTags },
      heightCm: details.heightCm && !Number.isNaN(heightParsed) ? heightParsed : undefined,
      maritalStatus: details.maritalStatus,
      hasChildren: details.hasChildren,
      occupation: details.occupation.trim() || undefined,
      practising: details.practising,
      prayerHabits: details.prayerHabits.trim() || undefined,
      halalOnly: details.halalOnly,
      smoking: details.smoking,
      drinking: details.drinking,
      religiousDress: details.religiousDress.trim() || undefined,
      openToRelocate: details.openToRelocate,
      preferredCountry: details.preferredCountry.trim() || undefined,
      careerPlans: details.careerPlans.trim() || undefined,
      educationLevel: details.educationLevel.trim() || undefined,
      degree: details.degree.trim() || undefined,
      jobTitle: details.jobTitle.trim() || undefined,
      industry: details.industry.trim() || undefined,
      languages: details.languagesText
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
      nationality: details.nationality.trim() || undefined,
      grewUpIn: details.grewUpIn.trim() || undefined,
      country: details.country.trim() || undefined,
      voiceIntroUri: voiceUri,
      voiceIntroDurationSec: voiceDuration,
      videoIntroUri: videoUri,
    });
    setSaving(false);
    router.back();
  };

  return (
    <ScreenContainer style={styles.screenContent}>
      <FadeIn>
        <LinearGradient
          colors={accent.ramp}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={[styles.hero, glow(accent.primary, 0.45, 20, 9)]}
        >
          <View style={styles.heroGlow} pointerEvents="none" />
          <View style={styles.heroIcon}>
            <Ionicons name="create" size={20} color="#FFFFFF" />
          </View>
          <Text style={[styles.heroTitle, rtl && styles.rtlText]}>{t('editProfile.title')}</Text>
        </LinearGradient>

        <AccentHeading title={t('photos.title')} gradient={accent.duo} style={styles.heading} />
        {prefs.blurPhotos && (
          <View style={styles.blurNotice}>
            <Ionicons name="eye-off-outline" size={14} color={colors.teal} />
            <Text style={styles.blurNoticeText}>{t('editProfile.blurNotice')}</Text>
          </View>
        )}
        <View style={styles.grid}>
          {photos.map((uri, index) => (
            <Pressable key={uri} onPress={() => setPrimaryPhoto(uri)}>
              {/* The rim carries the status: the primary photo wears the member's
                  own colours, the rest a plain hairline. */}
              <LinearGradient
                colors={index === 0 ? accent.ramp : idleRim}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.slotRim, index === 0 && glow(accent.primary, 0.45, 12, 6)]}
              >
                <View style={styles.slot}>
                  <Image source={{ uri }} style={styles.photo} />
                  {prefs.blurPhotos && (
                    <BlurView intensity={35} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                  )}
                  {index === 0 ? (
                    <View style={styles.primaryBadge}>
                      <Ionicons name="star" size={10} color="#FFFFFF" />
                      <Text style={styles.primaryBadgeText}>{t('editProfile.primaryPhoto')}</Text>
                    </View>
                  ) : (
                    // The whole tile already sets primary, but the action has to be
                    // visible — nobody discovers a tap-anywhere gesture on its own.
                    <Pressable onPress={() => setPrimaryPhoto(uri)} style={styles.makePrimaryBadge} hitSlop={6}>
                      <Ionicons name="star-outline" size={11} color="#FFFFFF" />
                      <Text style={styles.primaryBadgeText}>{t('editProfile.makePrimary')}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => removePhoto(uri)} style={styles.removeBadge} hitSlop={6}>
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                </View>
              </LinearGradient>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable onPress={addPhoto} style={styles.addSlot}>
              <Ionicons name="add" size={26} color={accent.primary} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.hint, rtl && styles.rtlText]}>{t('photos.primaryHint')}</Text>
      </FadeIn>

      <FadeIn delay={60}>
        <AccentHeading
          title={t('editProfile.introMediaTitle')}
          subtitle={t('editProfile.introMediaHint')}
          gradient={accent.duo}
          style={styles.heading}
        />

        {voiceUri ? (
          <View style={styles.voiceCard}>
            <Pressable onPress={toggleVoicePreview} style={[styles.voicePlayButton, { backgroundColor: colors.teal }]}>
              <Ionicons name={voiceStatus.playing ? 'pause' : 'play'} size={16} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.voiceDuration}>{formatDuration(voiceDuration ?? voiceStatus.duration ?? 0)}</Text>
            <Pressable onPress={removeVoiceIntro} style={styles.removeInlineButton} hitSlop={6}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={recording ? stopVoiceRecording : startVoiceRecording}
            style={[styles.mediaButton, recording && styles.mediaButtonActive]}
          >
            <Ionicons name={recording ? 'stop-circle' : 'mic-outline'} size={18} color={recording ? colors.danger : colors.teal} />
            <Text style={[styles.mediaButtonText, recording && { color: colors.danger }]}>
              {recording ? t('editProfile.stopRecording') : t('editProfile.recordVoiceIntro')}
            </Text>
          </Pressable>
        )}

        {videoUri ? (
          <View style={styles.videoPreviewWrap}>
            <Pressable onPress={toggleVideoPreview} style={styles.videoPreviewInner}>
              <VideoView player={videoPlayer} style={styles.videoPreview} contentFit="cover" nativeControls={false} />
              {!videoPlaying && (
                <View style={[StyleSheet.absoluteFill, styles.videoPlayOverlay]} pointerEvents="none">
                  <Ionicons name="play-circle" size={40} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            <Pressable onPress={removeVideoIntro} style={styles.removeBadge} hitSlop={6}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={pickVideoIntro} style={[styles.mediaButton, { marginTop: spacing.sm }]}>
            <Ionicons name="videocam-outline" size={18} color={colors.teal} />
            <Text style={styles.mediaButtonText}>{t('editProfile.addVideoIntro')}</Text>
          </Pressable>
        )}
      </FadeIn>

      <FadeIn delay={80}>
        <TextField
          label={t('editProfile.bio')}
          placeholder={t('editProfile.bioPlaceholder')}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          style={styles.bioInput}
        />

        <SelectField label={t('editProfile.city')} value={city} options={PAKISTAN_CITIES} onChange={setCity} placeholder={t('editProfile.city')} />
      </FadeIn>

      <FadeIn delay={140}>
        <AccentHeading title={t('profile.vibeTags')} gradient={accent.duo} style={styles.heading} />
        <View style={styles.chipRow}>
          {vibeTags.map((tag) => (
            <Chip key={tag} label={`${tag} ×`} selected tone="dating" onPress={() => removeTag(tag)} />
          ))}
        </View>
        <View style={styles.tagInputRow}>
          <View style={styles.tagInputField}>
            <TextField
              label={t('editProfile.addVibeTag')}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
          </View>
          <Button label={t('common.next')} variant="secondary" onPress={addTag} style={styles.addTagButton} />
        </View>
      </FadeIn>

      <FadeIn delay={180}>
        <AccentHeading title={t('discover.aboutMeTitle')} gradient={accent.duo} style={styles.sectionHeading} />
        <TextField
          label={t('editProfile.height')}
          value={details.heightCm}
          onChangeText={(v) => setField('heightCm', v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="170"
        />
        <Text style={[styles.fieldLabel, rtl && styles.rtlText]}>{t('editProfile.maritalStatus')}</Text>
        <View style={styles.chipRow}>
          {MARITAL_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={t(`attributes.maritalStatus${option.charAt(0).toUpperCase()}${option.slice(1)}`)}
              selected={details.maritalStatus === option}
              onPress={() => setField('maritalStatus', option)}
            />
          ))}
        </View>
        <BooleanRow label={t('attributes.hasChildrenYes')} value={details.hasChildren} onChange={(v) => setField('hasChildren', v)} rtl={rtl} />
        <TextField label={t('editProfile.occupation')} value={details.occupation} onChangeText={(v) => setField('occupation', v)} />
      </FadeIn>

      <FadeIn delay={220}>
        <AccentHeading title={t('discover.faithTitle')} gradient={accent.duo} style={styles.sectionHeading} />
        <BooleanRow label={t('attributes.practisingYes')} value={details.practising} onChange={(v) => setField('practising', v)} rtl={rtl} />
        <TextField label={t('editProfile.prayerHabits')} value={details.prayerHabits} onChangeText={(v) => setField('prayerHabits', v)} />
        <BooleanRow label={t('attributes.halalOnly')} value={details.halalOnly} onChange={(v) => setField('halalOnly', v)} rtl={rtl} />
        <BooleanRow label={t('attributes.smoker')} value={details.smoking} onChange={(v) => setField('smoking', v)} rtl={rtl} />
        <BooleanRow label={t('attributes.drinks')} value={details.drinking} onChange={(v) => setField('drinking', v)} rtl={rtl} />
        <TextField label={t('editProfile.religiousDress')} value={details.religiousDress} onChangeText={(v) => setField('religiousDress', v)} />
      </FadeIn>

      <FadeIn delay={260}>
        <AccentHeading title={t('discover.futurePlansTitle')} gradient={accent.duo} style={styles.sectionHeading} />
        <BooleanRow label={t('discover.openToRelocate')} value={details.openToRelocate} onChange={(v) => setField('openToRelocate', v)} rtl={rtl} />
        <TextField label={t('editProfile.preferredCountry')} value={details.preferredCountry} onChangeText={(v) => setField('preferredCountry', v)} />
        <TextField label={t('discover.careerPlansTitle')} value={details.careerPlans} onChangeText={(v) => setField('careerPlans', v)} />
      </FadeIn>

      <FadeIn delay={300}>
        <AccentHeading title={t('discover.educationCareerTitle')} gradient={accent.duo} style={styles.sectionHeading} />
        <SelectOrOtherField label={t('editProfile.educationLevel')} value={details.educationLevel} options={EDUCATION_LEVEL_OPTIONS} onChange={(v) => setField('educationLevel', v)} placeholder={t('editProfile.educationLevelPlaceholder')} />
        <SelectOrOtherField label={t('editProfile.degree')} value={details.degree} options={DEGREE_OPTIONS} onChange={(v) => setField('degree', v)} placeholder={t('editProfile.degreePlaceholder')} />
        <SelectOrOtherField label={t('editProfile.jobTitle')} value={details.jobTitle} options={JOB_TITLE_OPTIONS} onChange={(v) => setField('jobTitle', v)} />
        <SelectOrOtherField label={t('editProfile.industry')} value={details.industry} options={INDUSTRY_OPTIONS} onChange={(v) => setField('industry', v)} />
      </FadeIn>

      <FadeIn delay={340}>
        <AccentHeading title={t('discover.languagesBackgroundTitle')} gradient={accent.duo} style={styles.sectionHeading} />
        <SelectOrOtherField
          label={t('editProfile.languages')}
          value={details.languagesText}
          onChange={(v) => setField('languagesText', v)}
          options={PAKISTANI_LANGUAGE_OPTIONS}
          placeholder={t('editProfile.languagesPlaceholder')}
        />
        <SelectOrOtherField label={t('editProfile.nationality')} value={details.nationality} options={NATIONALITY_OPTIONS} onChange={(v) => setField('nationality', v)} />
        <SelectOrOtherField label={t('editProfile.grewUpIn')} value={details.grewUpIn} options={PAKISTAN_CITIES} onChange={(v) => setField('grewUpIn', v)} />
        <SelectOrOtherField label={t('editProfile.country')} value={details.country} options={COUNTRY_OPTIONS} onChange={(v) => setField('country', v)} />
      </FadeIn>

      <Button label={t('common.save')} onPress={onSave} loading={saving} gradient={accent.ramp} style={styles.submit} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function SelectOrOtherField({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  const selectedOption = value && options.includes(value) ? value : value ? OTHER_OPTION : null;
  const isOther = selectedOption === OTHER_OPTION;

  return (
    <>
      <SelectField
        label={label}
        value={selectedOption}
        options={options}
        onChange={(option) => onChange(option === OTHER_OPTION || option === null ? '' : option)}
        placeholder={placeholder}
      />
      {isOther && (
        <TextField
          label={t('editProfile.otherLabel', { label })}
          value={options.includes(value) ? '' : value}
          onChangeText={onChange}
          placeholder={t('common.enterAnswer')}
        />
      )}
    </>
  );
}

function BooleanRow({
  label,
  value,
  onChange,
  rtl,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  rtl: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.booleanRow, rtl && { flexDirection: 'row-reverse' }]}>
      <Text style={[styles.booleanLabel, rtl && styles.rtlText]}>{label}</Text>
      <Pressable onPress={() => onChange(!value)} hitSlop={6}>
        {value ? (
          <LinearGradient
            colors={[colors.teal, colors.sage]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={[styles.toggleTrack, glow(colors.teal, 0.6, 10, 4)]}
          >
            <View style={[styles.toggleThumb, styles.toggleThumbActive]} />
          </LinearGradient>
        ) : (
          <View style={styles.toggleTrack}>
            <View style={styles.toggleThumb} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Separate the form from the native navigation header on compact phones.
    screenContent: { paddingTop: spacing.xl },
    hero: {
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    // A blown-out highlight inside the hero, so the ramp reads as lit rather
    // than as a flat two-colour sweep.
    heroGlow: {
      position: 'absolute',
      top: -60,
      right: -30,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    heroIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { ...typography.h1, color: '#FFFFFF', fontWeight: '800' },
    heading: { marginBottom: spacing.sm },
    sectionHeading: { marginTop: spacing.lg, marginBottom: spacing.sm },
    fieldLabel: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs },
    blurNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    blurNoticeText: { ...typography.caption, color: colors.teal, flexShrink: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    slotRim: { width: 86, height: 106, borderRadius: radius.md + 2, padding: 2 },
    slot: { flex: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.skeleton },
    addSlot: {
      width: 86,
      height: 106,
      borderRadius: radius.md + 2,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    photo: { width: '100%', height: '100%' },
    primaryBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      right: 4,
      flexDirection: 'row',
      gap: 3,
      // Sits on the photo, so it needs its own dark chip rather than a theme
      // colour — `textInverse` on `overlay` was black-on-black in dark mode.
      backgroundColor: colors.teal,
      borderRadius: radius.sm,
      paddingVertical: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    makePrimaryBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      right: 4,
      flexDirection: 'row',
      gap: 3,
      backgroundColor: 'rgba(10,10,12,0.6)',
      borderRadius: radius.sm,
      paddingVertical: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBadgeText: { color: '#FFFFFF', fontSize: scaleFont(9), fontWeight: '700' },
    removeBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeText: { color: '#FFFFFF', fontSize: scaleFont(14), lineHeight: scaleFont(16) },
    hint: { ...typography.caption, color: colors.textTertiary, marginTop: -spacing.xs, marginBottom: spacing.md },
    mediaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1.5,
      borderColor: withAlpha(colors.teal, 0.4),
      borderStyle: 'dashed',
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      backgroundColor: withAlpha(colors.teal, 0.07),
    },
    mediaButtonActive: { borderColor: colors.danger, borderStyle: 'solid' },
    mediaButtonText: { ...typography.bodyBold, color: colors.teal },
    voiceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: withAlpha(colors.teal, 0.07),
      borderWidth: 1,
      borderColor: withAlpha(colors.teal, 0.3),
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    voicePlayButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    voiceDuration: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', flex: 1 },
    removeInlineButton: { padding: spacing.xs },
    videoPreviewWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.skeleton, marginTop: spacing.sm },
    videoPreviewInner: { flex: 1 },
    videoPreview: { width: '100%', height: '100%' },
    videoPlayOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,12,0.25)' },
    bioInput: { minHeight: 90, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
    tagInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    tagInputField: { flex: 1 },
    addTagButton: { marginBottom: spacing.md },
    submit: { marginTop: spacing.lg },
    booleanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    booleanLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
    toggleTrack: {
      width: 46,
      height: 27,
      borderRadius: 14,
      backgroundColor: colors.border,
      padding: 3,
      justifyContent: 'center',
    },
    toggleThumb: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFFFFF' },
    toggleThumbActive: { alignSelf: 'flex-end' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
