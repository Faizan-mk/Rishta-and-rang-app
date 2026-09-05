import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button } from '../Button';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import type { Palette } from '../../theme/palettes';

// The OS crop screen that `allowsEditing` opens is not dependable: on plenty of
// Android builds its confirm control sits behind the gesture bar or never draws,
// and iOS ignores a non-square `aspect` altogether. So we crop in-app and draw
// the button ourselves, where it is always visible.
interface ImageCropperProps {
  // The picked photo. `null` keeps the cropper closed.
  uri: string | null;
  // Width / height of the crop frame. Defaults to the 3:4 profile card shape.
  aspect?: number;
  // Draws the frame as a circle, for photos that are displayed round. The crop
  // itself is still the square the circle sits in — the rounding is the preview.
  round?: boolean;
  onCancel: () => void;
  onCropped: (uri: string) => void;
}

// Photos come off phone cameras far larger than we ever display them; cropping a
// 4000px original is slow and the result is pointlessly heavy.
const MAX_SOURCE_WIDTH = 1440;
const MAX_ZOOM = 6;
const JPEG = ImageManipulator.SaveFormat.JPEG;

interface Source {
  uri: string;
  width: number;
  height: number;
}

export function ImageCropper({ uri, aspect = 3 / 4, round = false, onCancel, onCropped }: ImageCropperProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const cropRamp = [colors.teal, colors.sage] as const;

  const [source, setSource] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  // As large as the screen allows while leaving room for the header above and
  // the buttons below.
  const frameWidth = Math.min(winWidth - spacing.lg * 2, winHeight * 0.52 * aspect);
  const frameHeight = frameWidth / aspect;
  const frameSize = {
    width: frameWidth,
    height: frameHeight,
    borderRadius: round ? frameWidth / 2 : radius.md,
  };

  // Re-encoding through the manipulator applies any EXIF rotation, so the pixel
  // size measured here is the one the crop coordinates will land on.
  useEffect(() => {
    let alive = true;
    setSource(null);
    setFailed(false);
    if (!uri) return;
    (async () => {
      try {
        const normalized = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.95, format: JPEG });
        const fitted =
          normalized.width > MAX_SOURCE_WIDTH
            ? await ImageManipulator.manipulateAsync(normalized.uri, [{ resize: { width: MAX_SOURCE_WIDTH } }], {
                compress: 0.95,
                format: JPEG,
              })
            : normalized;
        if (!alive) return;
        setSource({ uri: fitted.uri, width: fitted.width, height: fitted.height });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uri]);

  // Scale at which the photo exactly covers the frame — the zoomed-out limit, so
  // a crop can never include empty space.
  const baseScale = source ? Math.max(frameWidth / source.width, frameHeight / source.height) : 1;
  const baseWidth = source ? source.width * baseScale : 0;
  const baseHeight = source ? source.height * baseScale : 0;

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.uri]);

  const gesture = useMemo(() => {
    const limitX = (value: number, atScale: number) => {
      'worklet';
      const slack = Math.max(0, (baseWidth * atScale - frameWidth) / 2);
      return Math.min(slack, Math.max(-slack, value));
    };
    const limitY = (value: number, atScale: number) => {
      'worklet';
      const slack = Math.max(0, (baseHeight * atScale - frameHeight) / 2);
      return Math.min(slack, Math.max(-slack, value));
    };

    const pan = Gesture.Pan()
      .onStart(() => {
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        translateX.value = limitX(startX.value + e.translationX, scale.value);
        translateY.value = limitY(startY.value + e.translationY, scale.value);
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        startScale.value = scale.value;
      })
      .onUpdate((e) => {
        const next = Math.min(MAX_ZOOM, Math.max(1, startScale.value * e.scale));
        scale.value = next;
        translateX.value = limitX(translateX.value, next);
        translateY.value = limitY(translateY.value, next);
      });

    return Gesture.Simultaneous(pan, pinch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseWidth, baseHeight, frameWidth, frameHeight]);

  const imageStyle = useAnimatedStyle(() => ({
    width: baseWidth,
    height: baseHeight,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  const applyCrop = async () => {
    if (!source || saving) return;
    setSaving(true);
    try {
      const zoom = scale.value;
      // Display pixels per source pixel at the current zoom.
      const ratio = baseScale * zoom;
      const shownWidth = baseWidth * zoom;
      const shownHeight = baseHeight * zoom;
      const width = Math.min(source.width, Math.round(frameWidth / ratio));
      const height = Math.min(source.height, Math.round(frameHeight / ratio));
      const originX = Math.min(
        source.width - width,
        Math.max(0, Math.round(((shownWidth - frameWidth) / 2 - translateX.value) / ratio)),
      );
      const originY = Math.min(
        source.height - height,
        Math.max(0, Math.round(((shownHeight - frameHeight) / 2 - translateY.value) / ratio)),
      );
      const result = await ImageManipulator.manipulateAsync(
        source.uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.9, format: JPEG },
      );
      onCropped(result.uri);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={Boolean(uri)} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={onCancel} hitSlop={10} style={styles.close}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>{t('photos.cropTitle')}</Text>
          <View style={styles.close} />
        </View>

        <View style={styles.stage}>
          {source ? (
            <GestureDetector gesture={gesture}>
              <View style={[styles.frame, frameSize]}>
                <Animated.Image source={{ uri: source.uri }} style={imageStyle} resizeMode="cover" />
                {round ? null : (
                  <View pointerEvents="none" style={styles.guides}>
                    <View style={[styles.guideLine, styles.guideV, { left: '33.33%' }]} />
                    <View style={[styles.guideLine, styles.guideV, { left: '66.66%' }]} />
                    <View style={[styles.guideLine, styles.guideH, { top: '33.33%' }]} />
                    <View style={[styles.guideLine, styles.guideH, { top: '66.66%' }]} />
                  </View>
                )}
              </View>
            </GestureDetector>
          ) : (
            <View style={[styles.frame, frameSize]}>
              <ActivityIndicator color={colors.teal} />
            </View>
          )}
          <Text style={styles.hint}>{failed ? t('common.somethingWentWrong') : t('photos.cropHint')}</Text>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* The chrome here is always dark, so Cancel carries its own light
              styling rather than the palette's (dark-on-dark) ghost label. */}
          <Pressable onPress={onCancel} style={[styles.action, styles.cancel]}>
            <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
          </Pressable>
          <Button
            label={t('photos.cropAction')}
            onPress={applyCrop}
            disabled={!source}
            loading={saving}
            gradient={cropRamp}
            style={styles.action}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title: { ...typography.h3, color: '#FFFFFF', fontWeight: '800' },
    stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    frame: {
      overflow: 'hidden',
      backgroundColor: '#121212',
      borderWidth: 2,
      borderColor: withAlpha(colors.teal, 0.9),
      alignItems: 'center',
      justifyContent: 'center',
    },
    guides: { ...StyleSheet.absoluteFillObject },
    guideLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.28)' },
    guideV: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
    guideH: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
    hint: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.72)',
      textAlign: 'center',
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    action: { flex: 1 },
    cancel: {
      minHeight: 52,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: { ...typography.bodyBold, color: '#FFFFFF' },
  });
