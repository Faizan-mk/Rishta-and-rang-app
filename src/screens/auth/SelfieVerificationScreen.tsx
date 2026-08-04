import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = NativeStackScreenProps<AuthStackParamList, 'SelfieVerification'>;

export function SelfieVerificationScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl, language } = useLanguage();
  const { signup } = useAuth();
  const { notify } = useDialog();
  const { draft } = route.params;
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takeSelfie = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.cameraTitle'), message: t('permissions.cameraBody') });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
    }
  };

  const onFinish = async () => {
    if (!draft.intent) return;
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
      });
      // RootNavigator swaps to AppNavigator automatically once `user` is set.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <StepHeader total={5} current={4} onBack={() => navigation.goBack()} />
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

      {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}

      <Button
        label={t('common.done')}
        onPress={onFinish}
        disabled={!selfieUri}
        loading={submitting}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    previewWrap: { alignItems: 'center', marginBottom: spacing.lg },
    preview: { width: 180, height: 180, borderRadius: radius.pill, backgroundColor: colors.skeleton },
    previewEmpty: { alignItems: 'center', justifyContent: 'center' },
    previewPlaceholder: { fontSize: 56 },
    errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
    submit: { marginTop: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
