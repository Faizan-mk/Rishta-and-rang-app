import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ImageCropper } from '../../components/common/ImageCropper';
import { Button } from '../../components/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useOnboarding } from '../../store/onboardingStore';
import { analyzeIdCardPhoto } from '../../utils/idCardImageCheck';
import { errorMessage } from '../../utils/appError';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function SelfieVerificationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, language } = useLanguage();
  const onboardRamp = [colors.teal, colors.sage] as const;
  const { signup } = useAuth();
  const { notify } = useDialog();
  const { draft } = useOnboarding();
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  // The shot waiting to be cropped; null while the cropper is closed.
  const [pendingSelfie, setPendingSelfie] = useState<string | null>(null);
  const [cnicPhotoUri, setCnicPhotoUri] = useState<string | null>(null);
  const [checkingCnicPhoto, setCheckingCnicPhoto] = useState(false);
  const [cnicPhotoError, setCnicPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takeSelfie = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.cameraTitle'), message: t('permissions.cameraBody') });
      return;
    }
    // `allowsEditing` is deliberately off — see ImageCropper for why the OS crop
    // screen is not dependable. Cropping happens in-app instead.
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingSelfie(result.assets[0].uri);
    }
  };

  const onSelfieCropped = (uri: string) => {
    setPendingSelfie(null);
    setSelfieUri(uri);
  };

  const pickCnicPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.photoLibraryTitle'), message: t('permissions.photoLibraryBody') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setCnicPhotoError(null);
    setCnicPhotoUri(null);
    setCheckingCnicPhoto(true);
    const check = await analyzeIdCardPhoto(result.assets[0].uri);
    setCheckingCnicPhoto(false);

    if (!check.looksValid) {
      setCnicPhotoError(t(`cnic.imageCheckFailed_${check.reason ?? 'notCardColored'}`));
      return;
    }
    setCnicPhotoUri(result.assets[0].uri);
  };

  const onFinish = async () => {
    if (!draft?.intent) return;
    setError(null);
    setSubmitting(true);
    try {
      await signup({
        fullName: draft.fullName,
        email: draft.email,
        password: draft.password,
        dob: draft.dob,
        gender: draft.gender,
        city: draft.city,
        intent: draft.intent,
        language,
        bio: draft.bio,
        photos: draft.photos ?? [],
        selfieVerified: Boolean(selfieUri),
        selfieUri: selfieUri ?? undefined,
        cnicNumber: draft.cnicNumber,
        cnicPhotoUri: cnicPhotoUri ?? undefined,
      });
      // The root layout swaps to the (tabs) group automatically once `user` is set.
    } catch (e) {
      setError(errorMessage(e, t));
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <StepHeader total={3} current={2} onBack={() => router.back()} />
      <FadeIn>
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('selfie.title')}</Text>
        <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('selfie.subtitle')}</Text>

        <View style={styles.previewWrap}>
          {selfieUri ? (
            <Image source={{ uri: selfieUri }} style={styles.preview} />
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <Text style={styles.previewPlaceholder}>🤳</Text>
            </View>
          )}
        </View>

        <Button
          label={selfieUri ? t('common.retake') : t('selfie.takeSelfie')}
          variant="secondary"
          onPress={takeSelfie}
        />
      </FadeIn>

      <FadeIn delay={100}>
        <AccentHeading title={t('cnic.title')} gradient={onboardRamp} style={styles.sectionHeading} />
        <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('cnic.subtitle')}</Text>

        {cnicPhotoUri ? (
          <Image source={{ uri: cnicPhotoUri }} style={styles.cnicPreview} />
        ) : (
          <View style={[styles.cnicPreview, styles.previewEmpty]}>
            {checkingCnicPhoto ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.previewPlaceholder}>🪪</Text>}
          </View>
        )}

        <Button
          label={cnicPhotoUri ? t('common.retake') : t('cnic.uploadId')}
          variant="secondary"
          onPress={pickCnicPhoto}
          loading={checkingCnicPhoto}
        />
      </FadeIn>

      {cnicPhotoError ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{cnicPhotoError}</Text> : null}

      {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

      <Button
        label={t('common.done')}
        onPress={onFinish}
        disabled={!selfieUri || !cnicPhotoUri || checkingCnicPhoto}
        loading={submitting}
        style={styles.submit}
      />

      <ImageCropper uri={pendingSelfie} aspect={1} round onCancel={() => setPendingSelfie(null)} onCropped={onSelfieCropped} />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '800' },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    sectionHeading: { marginTop: spacing.lg, marginBottom: spacing.sm },
    previewWrap: { alignItems: 'center', marginBottom: spacing.lg },
    preview: {
      width: 180,
      height: 180,
      borderRadius: radius.pill,
      backgroundColor: colors.skeleton,
      borderWidth: 3,
      borderColor: withAlpha(colors.teal, 0.45),
      ...glow(colors.teal, 0.3, 18, 7),
    },
    cnicPreview: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.lg,
      backgroundColor: colors.skeleton,
      marginBottom: spacing.md,
      borderWidth: 2,
      borderColor: withAlpha(colors.teal, 0.35),
    },
    previewEmpty: { alignItems: 'center', justifyContent: 'center' },
    previewPlaceholder: { fontSize: scaleFont(56) },
    errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
    submit: { marginTop: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
