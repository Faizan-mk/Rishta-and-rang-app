import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
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
import { analyzeIdCardPhoto, CNIC_ASPECT } from '../../utils/idCardImageCheck';
import { AppError, errorMessage } from '../../utils/appError';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { cardSurface } from '../../theme/surfaces';

export function SelfieVerificationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, language } = useLanguage();
  const onboardRamp = [colors.teal, colors.dating] as const;
  const { signup } = useAuth();
  const { notify } = useDialog();
  const { draft, patchDraft } = useOnboarding();
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  // The shot waiting to be cropped; null while the cropper is closed.
  const [pendingSelfie, setPendingSelfie] = useState<string | null>(null);
  const [pendingCnicPhoto, setPendingCnicPhoto] = useState<string | null>(null);
  const [cnicPhotoUri, setCnicPhotoUri] = useState<string | null>(null);
  const [checkingCnicPhoto, setCheckingCnicPhoto] = useState(false);
  const [cnicPhotoError, setCnicPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same condition the Done button has always used; named so the button can
  // also light up with the brand ramp once it is enabled.
  const finishDisabled = !selfieUri || !cnicPhotoUri || checkingCnicPhoto;

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
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.cameraTitle'), message: t('permissions.cameraBody') });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setCnicPhotoError(null);
    setCnicPhotoUri(null);
    setPendingCnicPhoto(result.assets[0].uri);
  };

  const onCnicPhotoCropped = async (uri: string) => {
    setPendingCnicPhoto(null);
    setCheckingCnicPhoto(true);
    const check = await analyzeIdCardPhoto(uri);
    setCheckingCnicPhoto(false);

    if (!check.looksValid) {
      setCnicPhotoError(t(`cnic.imageCheckFailed_${check.reason ?? 'notCardColored'}`));
      return;
    }
    setCnicPhotoUri(uri);
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
        emailTicket: draft.emailTicket,
      });
      // The root layout swaps to the (tabs) group automatically once `user` is set.
    } catch (e) {
      // The verification outlived its ticket (the flow sat open too long):
      // drop it, so going back to step 1 sends a fresh code.
      if (e instanceof AppError && e.key === 'authErrors.otpTicketInvalid') {
        patchDraft({ emailTicket: undefined });
      }
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

        <View style={styles.card}>
          <View style={styles.previewWrap}>
            {/* Gold ring around the round selfie frame. */}
            <View style={styles.previewRing}>
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.preview} />
              ) : (
                <View style={[styles.preview, styles.previewEmpty]}>
                  <Ionicons name="happy-outline" size={64} color={colors.teal} />
                </View>
              )}
            </View>
            {selfieUri && (
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>

          <Button
            label={selfieUri ? t('common.retake') : t('selfie.takeSelfie')}
            variant="secondary"
            onPress={takeSelfie}
            icon={<Ionicons name="camera-outline" size={18} color={colors.textPrimary} />}
            style={styles.outlineButton}
            labelStyle={styles.outlineLabel}
          />
        </View>
      </FadeIn>

      <FadeIn delay={100}>
        <View style={[styles.card, styles.cardGap]}>
          <AccentHeading title={t('cnic.title')} gradient={onboardRamp} style={styles.sectionHeading} />
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('cnic.subtitle')}</Text>

          <View>
            {cnicPhotoUri ? (
              <Image source={{ uri: cnicPhotoUri }} style={styles.cnicPreview} />
            ) : (
              <View style={[styles.cnicPreview, styles.previewEmpty]}>
                {checkingCnicPhoto ? (
                  <ActivityIndicator color={colors.teal} />
                ) : (
                  <Ionicons name="card-outline" size={56} color={colors.teal} />
                )}
              </View>
            )}
            {cnicPhotoUri && (
              <View style={[styles.doneBadge, styles.cnicDoneBadge]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>

          <Button
            label={cnicPhotoUri ? t('common.retake') : t('cnic.uploadId')}
            variant="secondary"
            onPress={pickCnicPhoto}
            loading={checkingCnicPhoto}
            icon={<Ionicons name="scan-outline" size={18} color={colors.textPrimary} />}
            style={styles.outlineButton}
            labelStyle={styles.outlineLabel}
          />
        </View>
      </FadeIn>

      {cnicPhotoError ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.errorText, rtl && styles.rtlText]}>{cnicPhotoError}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={t('common.done')}
        onPress={onFinish}
        disabled={finishDisabled}
        loading={submitting}
        gradient={finishDisabled ? undefined : onboardRamp}
        style={styles.submit}
      />

      <ImageCropper uri={pendingSelfie} aspect={1} round onCancel={() => setPendingSelfie(null)} onCropped={onSelfieCropped} />
      <ImageCropper
        uri={pendingCnicPhoto}
        aspect={CNIC_ASPECT}
        onCancel={() => setPendingCnicPhoto(null)}
        onCropped={onCnicPhotoCropped}
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    card: { ...cardSurface(colors), paddingBottom: spacing.lg },
    cardGap: { marginTop: spacing.md },
    sectionHeading: { marginBottom: spacing.sm },
    previewWrap: { alignSelf: 'center', marginBottom: spacing.lg },
    previewRing: {
      padding: 5,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.gold,
      ...glow(colors.teal, 0.18, 18, 5),
      backgroundColor: colors.surface,
    },
    preview: {
      width: 168,
      height: 168,
      borderRadius: radius.pill,
      backgroundColor: colors.skeleton,
    },
    cnicPreview: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.md,
      backgroundColor: colors.skeleton,
      marginBottom: spacing.md,
      borderWidth: 1.5,
      borderColor: withAlpha(colors.gold, 0.7),
    },
    previewEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealSoft },
    // Emerald seal once a shot is captured.
    doneBadge: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    cnicDoneBadge: { right: 10, top: 10, bottom: undefined },
    // Secondary action per the design system: outlined champagne-gold pill.
    outlineButton: { borderColor: colors.gold, backgroundColor: 'transparent' },
    outlineLabel: { color: colors.textPrimary },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: withAlpha(colors.danger, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.35),
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    errorText: { ...typography.caption, color: colors.danger, flexShrink: 1 },
    submit: { marginTop: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
