import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/Button';
import { ArchBadge } from '../../components/common/ArchBadge';
import { TextField } from '../../components/common/TextField';
import { FadeIn } from '../../components/common/FadeInUp';
import { ImageCropper } from '../../components/common/ImageCropper';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { digitsToCnicDisplay, isValidCnicFormat, cnicMatchesGender, maskCnic } from '../../utils/cnic';
import { analyzeIdCardPhoto, CNIC_ASPECT } from '../../utils/idCardImageCheck';
import { fonts, radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

export function CnicVerificationScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser } = useAuth();
  const { notify } = useDialog();

  const [editing, setEditing] = useState(false);
  const [cnicNumber, setCnicNumber] = useState('');
  const [cnicPhotoUri, setCnicPhotoUri] = useState<string | null>(null);
  const [pendingCnicPhoto, setPendingCnicPhoto] = useState<string | null>(null);
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);

  if (!user) return null;

  const startEditing = () => {
    setCnicNumber(user.cnicNumber ?? '');
    setCnicPhotoUri(user.cnicPhotoUri ?? null);
    setPhotoError(null);
    setNumberError(null);
    setEditing(true);
  };

  const onCnicChange = (input: string) => {
    setNumberError(null);
    setCnicNumber(digitsToCnicDisplay(input.replace(/\D/g, '')));
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

    setPhotoError(null);
    setCnicPhotoUri(null);
    setPendingCnicPhoto(result.assets[0].uri);
  };

  const onCnicPhotoCropped = async (uri: string) => {
    setPendingCnicPhoto(null);
    setCheckingPhoto(true);
    const check = await analyzeIdCardPhoto(uri);
    setCheckingPhoto(false);

    if (!check.looksValid) {
      setPhotoError(t(`cnic.imageCheckFailed_${check.reason ?? 'notCardColored'}`));
      return;
    }
    setCnicPhotoUri(uri);
  };

  const onSave = async () => {
    if (!isValidCnicFormat(cnicNumber)) {
      setNumberError(t('cnic.invalidFormat'));
      return;
    }
    if (!cnicMatchesGender(cnicNumber, user.gender)) {
      setNumberError(t('cnic.genderMismatch'));
      return;
    }
    setSaving(true);
    await updateUser({ ...user, cnicNumber, cnicPhotoUri: cnicPhotoUri ?? undefined, cnicVerified: true });
    setSaving(false);
    setEditing(false);
    await notify({ title: t('cnic.title'), message: t('cnic.updateSuccess') });
  };

  return (
    <ScreenContainer>
      <FadeIn>
        <ArchBadge icon="card-outline" style={styles.badge} />
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('cnic.title')}</Text>

        {user.cnicVerified && !editing && (
          <>
            <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('cnic.detailSubtitle')}</Text>

            {user.cnicPhotoUri && <Image source={{ uri: user.cnicPhotoUri }} style={styles.preview} />}

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.label, rtl && styles.rtlText]}>{t('cnic.number')}</Text>
                <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={8}>
                  <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.value}>{user.cnicNumber ? (revealed ? user.cnicNumber : maskCnic(user.cnicNumber)) : '—'}</Text>
            </View>

            <View style={[styles.verifiedRow, rtl && styles.rowRtl]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.verifiedText}>{t('cnic.verified')}</Text>
            </View>

            <Button
              label={t('cnic.update')}
              variant="secondary"
              onPress={startEditing}
              style={styles.updateButton}
              labelStyle={styles.outlineLabel}
            />
          </>
        )}

        {user.cnicVerified && editing && (
          <>
            <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('cnic.subtitle')}</Text>

            <TextField
              label={t('cnic.number')}
              value={cnicNumber}
              onChangeText={onCnicChange}
              placeholder={t('cnic.numberPlaceholder')}
              keyboardType="number-pad"
              maxLength={15}
              error={numberError ?? undefined}
            />

            {cnicPhotoUri ? (
              <Image source={{ uri: cnicPhotoUri }} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.previewEmpty]}>
                {checkingPhoto ? (
                  <ActivityIndicator color={colors.teal} />
                ) : (
                  <Ionicons name="card-outline" size={52} color={colors.teal} />
                )}
              </View>
            )}
            {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}

            <Button
              label={cnicPhotoUri ? t('common.retake') : t('cnic.uploadId')}
              variant="secondary"
              onPress={pickCnicPhoto}
              loading={checkingPhoto}
              icon={<Ionicons name="scan-outline" size={18} color={colors.textPrimary} />}
              style={styles.outlineButton}
              labelStyle={styles.outlineLabel}
            />

            <View style={styles.editActions}>
              <Button
                label={t('common.save')}
                onPress={onSave}
                loading={saving}
                disabled={checkingPhoto}
                gradient={checkingPhoto ? undefined : [colors.teal, colors.dating]}
                style={styles.editActionButton}
              />
              <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} style={styles.editActionButton} />
            </View>
          </>
        )}

        {!user.cnicVerified && (
          <View style={styles.notVerifiedCard}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
            <Text style={[styles.notVerifiedText, rtl && styles.rtlText]}>{t('cnic.notVerifiedInfo')}</Text>
          </View>
        )}
      </FadeIn>

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
    badge: { marginBottom: spacing.md },
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center' },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
    preview: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radius.md,
      backgroundColor: colors.skeleton,
      marginBottom: spacing.md,
      borderWidth: 1.5,
      borderColor: withAlpha(colors.gold, 0.7),
    },
    previewEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealSoft },
    card: { ...cardSurface(colors), paddingBottom: spacing.lg, marginBottom: spacing.md },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    label: { ...typography.label, color: colors.textSecondary, marginBottom: 0 },
    value: { ...typography.h3, color: colors.textPrimary },
    // Pale-emerald seal pill, the design system's "verified" tone.
    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: spacing.xs,
      backgroundColor: colors.successSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    verifiedText: { ...typography.label, color: colors.success, fontFamily: fonts.bodyBold },
    updateButton: { marginTop: spacing.lg, borderColor: colors.gold, backgroundColor: 'transparent' },
    outlineButton: { borderColor: colors.gold, backgroundColor: 'transparent' },
    outlineLabel: { color: colors.textPrimary },
    editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    editActionButton: { flex: 1 },
    errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs, marginBottom: spacing.sm },
    notVerifiedCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.goldSoft,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.5),
      padding: spacing.md,
    },
    notVerifiedText: { ...typography.body, color: colors.textSecondary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
