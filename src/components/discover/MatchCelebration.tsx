import React, { useEffect, useMemo } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../Button';
import { radius, spacing, typography } from '../../theme';
import { glow } from '../../theme/glow';
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
        <LinearGradient
          colors={[colors.rishta, colors.dating, colors.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, glow(colors.dating, 0.6, 30, 14)]}
        >
          <View style={styles.glowA} pointerEvents="none" />
          <View style={styles.glowB} pointerEvents="none" />
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
    card: {
      width: '100%',
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      overflow: 'hidden',
    },
    glowA: {
      position: 'absolute',
      top: -70,
      left: -40,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    glowB: {
      position: 'absolute',
      bottom: -80,
      right: -40,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    title: { ...typography.h1, color: '#FFFFFF', marginTop: spacing.md, fontWeight: '800' },
    subtitle: { ...typography.body, color: 'rgba(255,255,255,0.9)', marginTop: spacing.xs, textAlign: 'center' },
    photo: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginTop: spacing.lg,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    button: { marginTop: spacing.xl, width: '100%' },
  });
