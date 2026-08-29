import React, { useEffect, useMemo } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../Button';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface MatchCelebrationProps {
  visible: boolean;
  name: string;
  photo: string;
  onClose: () => void;
}

export function MatchCelebration({ visible, name, photo, onClose }: MatchCelebrationProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useLanguage();
  const heartScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      heartScale.value = withSequence(
        withTiming(1.3, { duration: 320, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 160 })
      );
    } else {
      heartScale.value = 0;
    }
  }, [visible]);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={[colors.rishta, colors.dating]} style={styles.card}>
          <Animated.View style={heartStyle}>
            <Ionicons name="heart" size={56} color="#FFFFFF" />
          </Animated.View>
          <Text style={styles.title}>{t('matches.itsAMatch')}</Text>
          <Text style={styles.subtitle}>{t('matches.youAndLikedEachOther', { name })}</Text>
          <Image source={{ uri: photo }} style={styles.photo} />
          <Button label={t('common.continue')} variant="secondary" onPress={onClose} style={styles.button} />
        </LinearGradient>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    card: { width: '100%', borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
    title: { ...typography.h1, color: '#FFFFFF', marginTop: spacing.md },
    subtitle: { ...typography.body, color: 'rgba(255,255,255,0.9)', marginTop: spacing.xs, textAlign: 'center' },
    photo: { width: 96, height: 96, borderRadius: 48, marginTop: spacing.lg, borderWidth: 3, borderColor: '#FFFFFF' },
    button: { marginTop: spacing.xl, width: '100%' },
  });
