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
import { cardSurface } from '../../theme/surfaces';
import type { Palette } from '../../theme/palettes';

const MAX_PHOTOS = 4;
const MIN_PHOTOS = 2;

// Purely decorative: one icon per intent card.
const INTENT_ICONS: Record<Intent, keyof typeof Ionicons.glyphMap> = {
  casual: 'cafe-outline',
  serious: 'heart-outline',
  matrimonial: 'diamond-outline',
};

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
  const onboardRamp = [colors.teal, colors.dating] as const;

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
            <Pressable
              onPress={() => setSelected(option.key)}
              style={[styles.card, isSelected && styles.cardSelected, rtl && styles.rowRtl]}
            >
              <View style={[styles.iconDisc, isSelected && styles.iconDiscSelected]}>
                <Ionicons
                  name={INTENT_ICONS[option.key]}
                  size={22}
                  color={isSelected ? colors.textInverse : colors.teal}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={[isSelected ? styles.cardTitleSelected : styles.cardTitle, rtl && styles.rtlText]}>
                  {t(option.titleKey)}
                </Text>
                <Text style={[isSelected ? styles.cardDescSelected : styles.cardDesc, rtl && styles.rtlText]}>
                  {t(option.descKey)}
                </Text>
              </View>
              <View style={[styles.radio, isSelected && styles.radioOn]}>
                {isSelected && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      <View style={styles.photosCard}>
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
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable onPress={pickPhoto} style={[styles.slot, styles.addSlot]}>
              <View style={styles.addDisc}>
                <Ionicons name="camera-outline" size={26} color={colors.teal} />
              </View>
              <Text style={styles.addLabel}>{t('photos.addPhoto')}</Text>
            </Pressable>
          )}
        </View>

        {photos.length < MIN_PHOTOS ? (
          <Text style={[styles.hint, rtl && styles.rtlText]}>{t('photos.minRequired')}</Text>
        ) : (
          <Text style={[styles.hint, styles.hintNeutral, rtl && styles.rtlText]}>{t('photos.primaryHint')}</Text>
        )}
      </View>

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
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    sectionHeading: { marginBottom: spacing.sm },
    rowRtl: { flexDirection: 'row-reverse' },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm + 4,
      backgroundColor: colors.surface,
    },
    cardSelected: {
      borderWidth: 1.5,
      borderColor: colors.teal,
      backgroundColor: colors.tealSoft,
      ...glow(colors.teal, 0.18, 14, 4),
    },
    iconDisc: {
      width: 46,
      height: 46,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tealSoft,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.5),
    },
    iconDiscSelected: { backgroundColor: colors.teal, borderColor: colors.gold },
    cardText: { flex: 1 },
    cardTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 2 },
    cardTitleSelected: { ...typography.h3, color: colors.teal, marginBottom: 2 },
    cardDesc: { ...typography.caption, color: colors.textSecondary },
    cardDescSelected: { ...typography.caption, color: colors.textPrimary },
    radio: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { backgroundColor: colors.teal, borderColor: colors.teal },
    photosCard: { ...cardSurface(colors), marginTop: spacing.md, paddingBottom: spacing.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
    // Each photo sits in a Mughal-arch frame; the oversized top radius is
    // clamped to half the width, giving a full arched crest.
    slot: {
      width: '48%',
      aspectRatio: 3 / 4,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    addSlot: {
      borderWidth: 1.5,
      borderColor: withAlpha(colors.gold, 0.7),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tealSoft,
    },
    addDisc: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    photo: { width: '100%', height: '100%' },
    addLabel: { ...typography.label, color: colors.teal, marginTop: spacing.sm, textAlign: 'center' },
    primaryBadge: {
      position: 'absolute',
      bottom: 8,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 4,
      backgroundColor: colors.gold,
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    makePrimaryBadge: {
      position: 'absolute',
      bottom: 8,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 4,
      backgroundColor: 'rgba(20,11,16,0.6)',
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { ...typography.label, color: '#FFFFFF', fontSize: scaleFont(10), lineHeight: scaleFont(13) },
    removeBadge: {
      position: 'absolute',
      top: '22%',
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(20,11,16,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: { ...typography.caption, color: colors.teal, marginTop: spacing.md },
    hintNeutral: { color: colors.textSecondary },
    submit: { marginTop: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
