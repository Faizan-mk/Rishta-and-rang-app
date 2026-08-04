import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhotoUpload'>;

const MAX_PHOTOS = 4;
const MIN_PHOTOS = 2;

export function PhotoUploadScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { notify } = useDialog();
  const { draft } = route.params;
  const [photos, setPhotos] = useState<string[]>([]);

  const pickPhoto = async () => {
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

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const onNext = () => {
    navigation.navigate('SelfieVerification', { draft: { ...draft, photos } });
  };

  return (
    <ScreenContainer>
      <StepHeader total={5} current={3} onBack={() => navigation.goBack()} />
      <Text style={[styles.title, rtl && styles.rtlText]}>{t('photos.title')}</Text>
      <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('photos.subtitle')}</Text>

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
          <Pressable onPress={pickPhoto} style={[styles.slot, styles.addSlot]}>
            <Text style={styles.addPlus}>+</Text>
            <Text style={styles.addLabel}>{t('photos.addPhoto')}</Text>
          </Pressable>
        )}
      </View>

      {photos.length < MIN_PHOTOS && (
        <Text style={[styles.hint, rtl && styles.rtlText]}>{t('photos.minRequired')}</Text>
      )}

      <Button
        label={t('common.next')}
        onPress={onNext}
        disabled={photos.length < MIN_PHOTOS}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    slot: { width: '47%', aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden' },
    addSlot: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    photo: { width: '100%', height: '100%' },
    addPlus: { fontSize: 32, color: colors.teal, marginBottom: 4 },
    addLabel: { ...typography.caption, color: colors.textSecondary },
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
    removeText: { color: colors.textInverse, fontSize: 16, lineHeight: 18 },
    hint: { ...typography.caption, color: colors.warning, marginTop: spacing.md },
    submit: { marginTop: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
