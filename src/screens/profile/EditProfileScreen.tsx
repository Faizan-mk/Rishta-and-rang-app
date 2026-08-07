import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
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
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'EditProfile'>;

const MAX_PHOTOS = 4;

export function EditProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
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
  const [saving, setSaving] = useState(false);

  if (!user) return null;

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

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || vibeTags.includes(trimmed)) return;
    setVibeTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setVibeTags((prev) => prev.filter((t2) => t2 !== tag));

  const onSave = async () => {
    setSaving(true);
    await updateUser({
      ...user,
      bio,
      city: city ?? '',
      photos,
      dating: { ...user.dating, vibeTags },
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
          {photos.map((uri) => (
            <Pressable key={uri} onPress={() => removePhoto(uri)} style={styles.slot}>
              <Image source={{ uri }} style={styles.photo} />
              <View style={styles.removeBadge}>
                <Text style={styles.removeText}>×</Text>
              </View>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable onPress={addPhoto} style={[styles.slot, styles.addSlot]}>
              <Text style={styles.addPlus}>+</Text>
            </Pressable>
          )}
        </View>
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

      <Button label={t('common.save')} onPress={onSave} loading={saving} style={styles.submit} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
    label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
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
    bioInput: { minHeight: 90, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
    tagInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    tagInputField: { flex: 1 },
    addTagButton: { marginBottom: spacing.md },
    submit: { marginTop: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
