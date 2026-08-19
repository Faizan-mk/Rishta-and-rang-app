import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEvent } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { AppStackScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { SelectField } from '../../components/common/SelectField';
import { Button } from '../../components/common/Button';
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
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'EditProfile'>;

const MAX_PHOTOS = 4;
const MARITAL_OPTIONS: NonNullable<UserProfile['maritalStatus']>[] = ['single', 'divorced', 'widowed'];

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

export function EditProfileScreen({ navigation }: Props) {
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
      quality: 0.7,
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
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <FadeIn>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('editProfile.title')}</Text>

        <Text style={[styles.label, rtl && styles.rtlText]}>{t('photos.title')}</Text>
        {prefs.blurPhotos && (
          <View style={styles.blurNotice}>
            <Ionicons name="eye-off-outline" size={14} color={colors.teal} />
            <Text style={styles.blurNoticeText}>{t('editProfile.blurNotice')}</Text>
          </View>
        )}
        <View style={styles.grid}>
          {photos.map((uri, index) => (
            <Pressable key={uri} onPress={() => setPrimaryPhoto(uri)} style={styles.slot}>
              <Image source={{ uri }} style={styles.photo} />
              {prefs.blurPhotos && (
                <BlurView intensity={35} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              )}
              {index === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>{t('editProfile.primaryPhoto')}</Text>
                </View>
              )}
              <Pressable onPress={() => removePhoto(uri)} style={styles.removeBadge} hitSlop={6}>
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable onPress={addPhoto} style={[styles.slot, styles.addSlot]}>
              <Text style={styles.addPlus}>+</Text>
            </Pressable>
          )}
        </View>
        {photos.length > 1 && <Text style={[styles.hint, rtl && styles.rtlText]}>{t('editProfile.photoHint')}</Text>}
      </FadeIn>

      <FadeIn delay={60}>
        <Text style={[styles.label, rtl && styles.rtlText]}>{t('editProfile.introMediaTitle')}</Text>
        <Text style={[styles.hint, { marginTop: 0 }, rtl && styles.rtlText]}>{t('editProfile.introMediaHint')}</Text>

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
        <Text style={[styles.label, rtl && styles.rtlText]}>{t('profile.vibeTags')}</Text>
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
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('discover.aboutMeTitle')}</Text>
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
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('discover.faithTitle')}</Text>
        <BooleanRow label={t('attributes.practisingYes')} value={details.practising} onChange={(v) => setField('practising', v)} rtl={rtl} />
        <TextField label={t('editProfile.prayerHabits')} value={details.prayerHabits} onChangeText={(v) => setField('prayerHabits', v)} />
        <BooleanRow label={t('attributes.halalOnly')} value={details.halalOnly} onChange={(v) => setField('halalOnly', v)} rtl={rtl} />
        <BooleanRow label={t('attributes.smoker')} value={details.smoking} onChange={(v) => setField('smoking', v)} rtl={rtl} />
        <BooleanRow label={t('attributes.drinks')} value={details.drinking} onChange={(v) => setField('drinking', v)} rtl={rtl} />
        <TextField label={t('editProfile.religiousDress')} value={details.religiousDress} onChangeText={(v) => setField('religiousDress', v)} />
      </FadeIn>

      <FadeIn delay={260}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('discover.futurePlansTitle')}</Text>
        <BooleanRow label={t('discover.openToRelocate')} value={details.openToRelocate} onChange={(v) => setField('openToRelocate', v)} rtl={rtl} />
        <TextField label={t('editProfile.preferredCountry')} value={details.preferredCountry} onChangeText={(v) => setField('preferredCountry', v)} />
        <TextField label={t('discover.careerPlansTitle')} value={details.careerPlans} onChangeText={(v) => setField('careerPlans', v)} />
      </FadeIn>

      <FadeIn delay={300}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('discover.educationCareerTitle')}</Text>
        <TextField label={t('editProfile.educationLevel')} value={details.educationLevel} onChangeText={(v) => setField('educationLevel', v)} placeholder={t('editProfile.educationLevelPlaceholder')} />
        <TextField label={t('editProfile.degree')} value={details.degree} onChangeText={(v) => setField('degree', v)} placeholder={t('editProfile.degreePlaceholder')} />
        <TextField label={t('editProfile.jobTitle')} value={details.jobTitle} onChangeText={(v) => setField('jobTitle', v)} />
        <TextField label={t('editProfile.industry')} value={details.industry} onChangeText={(v) => setField('industry', v)} />
      </FadeIn>

      <FadeIn delay={340}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('discover.languagesBackgroundTitle')}</Text>
        <TextField
          label={t('editProfile.languages')}
          value={details.languagesText}
          onChangeText={(v) => setField('languagesText', v)}
          placeholder={t('editProfile.languagesPlaceholder')}
        />
        <TextField label={t('editProfile.nationality')} value={details.nationality} onChangeText={(v) => setField('nationality', v)} />
        <TextField label={t('editProfile.grewUpIn')} value={details.grewUpIn} onChangeText={(v) => setField('grewUpIn', v)} />
        <TextField label={t('editProfile.country')} value={details.country} onChangeText={(v) => setField('country', v)} />
      </FadeIn>

      <Button label={t('common.save')} onPress={onSave} loading={saving} style={styles.submit} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
      <Pressable onPress={() => onChange(!value)} style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
    fieldLabel: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs },
    blurNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    blurNoticeText: { ...typography.caption, color: colors.teal, flexShrink: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    slot: { width: 80, height: 100, borderRadius: radius.md, overflow: 'hidden' },
    addSlot: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    photo: { width: '100%', height: '100%' },
    addPlus: { fontSize: scaleFont(26), color: colors.teal },
    primaryBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      right: 4,
      backgroundColor: colors.overlay,
      borderRadius: radius.sm,
      paddingVertical: 2,
      alignItems: 'center',
    },
    primaryBadgeText: { color: colors.textInverse, fontSize: scaleFont(9), fontWeight: '700' },
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
    removeText: { color: colors.textInverse, fontSize: scaleFont(14), lineHeight: scaleFont(16) },
    hint: { ...typography.caption, color: colors.textTertiary, marginTop: -spacing.xs, marginBottom: spacing.md },
    mediaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: radius.lg,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.surface,
    },
    mediaButtonActive: { borderColor: colors.danger, borderStyle: 'solid' },
    mediaButtonText: { ...typography.bodyBold, color: colors.teal },
    voiceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      width: 44,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.border,
      padding: 3,
      justifyContent: 'center',
    },
    toggleTrackActive: { backgroundColor: colors.teal },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
    toggleThumbActive: { alignSelf: 'flex-end' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
