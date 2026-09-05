import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { Intent } from '../../types/user';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ImageCropper } from '../../components/common/ImageCropper';
import { Button } from '../../components/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useOnboarding } from '../../store/onboardingStore';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const MAX_PHOTOS = 4;
const MIN_PHOTOS = 2;

const OPTIONS: { key: Intent; titleKey: string; descKey: string }[] = [
  { key: 'casual', titleKey: 'intent.casualTitle', descKey: 'intent.casualDesc' },
  { key: 'serious', titleKey: 'intent.seriousTitle', descKey: 'intent.seriousDesc' },
  { key: 'matrimonial', titleKey: 'intent.matrimonialTitle', descKey: 'intent.matrimonialDesc' },
];

export function IntentPhotosScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const onboardRamp = [colors.teal, colors.sage] as const;

  const { notify } = useDialog();
  const { draft, patchDraft } = useOnboarding();
  const [selected, setSelected] = useState<Intent | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  // The photo waiting to be cropped; null while the cropper is closed.
  const [pending, setPending] = useState<string | null>(null);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.photoLibraryTitle'), message: t('permissions.photoLibraryBody') });
      return;
    }
    // `allowsEditing` is deliberately off: the OS crop screen it opens hides or
    // drops its confirm button on many Android builds, and ignores a 3:4 aspect
    // on iOS. ImageCropper below does the framing instead.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setPending(result.assets[0].uri);
    }
  };

  const onCropped = (uri: string) => {
    setPending(null);
    setPhotos((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
  };

  // The first photo is the one everyone sees on the deck card, so it has to be
  // choosable at sign-up — not only later in Edit Profile.
  const setPrimaryPhoto = (uri: string) => setPhotos((prev) => [uri, ...prev.filter((p) => p !== uri)]);

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const canContinue = Boolean(selected) && photos.length >= MIN_PHOTOS;

  const onNext = () => {
    if (!selected) return;
    patchDraft({ intent: selected, photos });
    router.push('/selfie-verification');
  };

  return (
    <ScreenContainer>
      <StepHeader total={3} current={1} onBack={() => router.back()} />

      <Text style={[styles.title, rtl && styles.rtlText]}>{t('intent.title')}</Text>
      <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('intent.subtitle')}</Text>

      {OPTIONS.map((option, index) => {
        const isSelected = selected === option.key;
        return (
          <Animated.View key={option.key} entering={FadeInUp.delay(index * 90).duration(360)}>
            <Pressable onPress={() => setSelected(option.key)} style={[styles.card, isSelected && styles.cardSelected]}>
              <Text style={[isSelected ? styles.cardTitleSelected : styles.cardTitle, rtl && styles.rtlText]}>
                {t(option.titleKey)}
              </Text>
              <Text style={[isSelected ? styles.cardDescSelected : styles.cardDesc, rtl && styles.rtlText]}>
                {t(option.descKey)}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}

      <AccentHeading title={t('photos.title')} gradient={onboardRamp} style={styles.sectionHeading} />
      <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('photos.subtitle')}</Text>

      <View style={styles.grid}>
        {photos.map((uri, index) => (
          <Pressable key={uri} onPress={() => setPrimaryPhoto(uri)} style={styles.slot}>
            <Image source={{ uri }} style={styles.photo} />
            {index === 0 ? (
              <View style={styles.primaryBadge}>
                <Ionicons name="star" size={10} color="#FFFFFF" />
                <Text style={styles.badgeText}>{t('photos.primaryPhoto')}</Text>
              </View>
            ) : (
              <Pressable onPress={() => setPrimaryPhoto(uri)} style={styles.makePrimaryBadge} hitSlop={6}>
                <Ionicons name="star-outline" size={11} color="#FFFFFF" />
                <Text style={styles.badgeText}>{t('photos.makePrimary')}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => removePhoto(uri)} style={styles.removeBadge} hitSlop={6}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </Pressable>
        ))}
        {photos.length < MAX_PHOTOS && (
          <Pressable onPress={pickPhoto} style={[styles.slot, styles.addSlot]}>
            <Ionicons name="camera-outline" size={32} color={colors.teal} />
            <Text style={styles.addLabel}>{t('photos.addPhoto')}</Text>
          </Pressable>
        )}
      </View>

      {photos.length < MIN_PHOTOS ? (
        <Text style={[styles.hint, rtl && styles.rtlText]}>{t('photos.minRequired')}</Text>
      ) : (
        <Text style={[styles.hint, styles.hintNeutral, rtl && styles.rtlText]}>{t('photos.primaryHint')}</Text>
      )}

      <Button
        label={t('common.next')}
        onPress={onNext}
        disabled={!canContinue}
        gradient={canContinue ? onboardRamp : undefined}
        style={styles.submit}
      />

      <ImageCropper uri={pending} aspect={3 / 4} onCancel={() => setPending(null)} onCropped={onCropped} />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '800' },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    sectionHeading: { marginTop: spacing.sm, marginBottom: spacing.sm },
    card: {
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: colors.surfaceElevated,
    },
    cardSelected: {
      borderColor: colors.teal,
      backgroundColor: colors.tealSoft,
      ...glow(colors.teal, 0.25, 12, 4),
    },
    cardTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4, fontWeight: '800' },
    cardTitleSelected: { ...typography.h3, color: colors.teal, marginBottom: 4, fontWeight: '800' },
    cardDesc: { ...typography.body, color: colors.textSecondary },
    cardDescSelected: { ...typography.body, color: colors.textPrimary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    slot: {
      width: '47%',
      aspectRatio: 3 / 4,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    addSlot: {
      borderWidth: 1.5,
      borderColor: withAlpha(colors.teal, 0.4),
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    photo: { width: '100%', height: '100%' },
    addLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
    primaryBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      right: 4,
      flexDirection: 'row',
      gap: 3,
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
    badgeText: { color: '#FFFFFF', fontSize: scaleFont(9), fontWeight: '700' },
    removeBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeText: { color: '#FFFFFF', fontSize: scaleFont(16), lineHeight: scaleFont(18) },
    hint: { ...typography.caption, color: colors.warning, marginTop: spacing.md },
    hintNeutral: { color: colors.textSecondary },
    submit: { marginTop: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
