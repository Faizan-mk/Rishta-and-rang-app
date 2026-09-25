import React, { useEffect, useMemo } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../Button';
import { FloatingHearts } from '../common/FloatingHearts';
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
        {/* A wedding-card moment: rosewood velvet, a gold hairline and gold
            hearts drifting up. Fixed colours, so it reads the same in both themes. */}
        <LinearGradient
          colors={VELVET}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, glow('#8E1B45', 0.5, 30, 14)]}
        >
          <View style={styles.glowA} pointerEvents="none" />
          <View style={styles.glowB} pointerEvents="none" />
          {visible && <FloatingHearts colors={[GOLD, 'rgba(255,255,255,0.6)', GOLD]} />}
          <Animated.View style={[styles.heartSeal, heartStyle]}>
            <Ionicons name="heart" size={34} color={GOLD} />
          </Animated.View>
          <View style={styles.flourish}>
            <View style={styles.flourishLine} />
            <View style={styles.flourishDiamond} />
            <View style={styles.flourishLine} />
          </View>
          <Text style={styles.title}>{t('matches.itsAMatch')}</Text>
          <Text style={styles.subtitle}>{t('matches.youAndLikedEachOther', { name })}</Text>
          <View style={styles.photoFrame}>
            <Image source={{ uri: photo }} style={styles.photo} />
          </View>
          <Button
            label={t('common.continue')}
            variant="secondary"
            onPress={onClose}
            style={styles.button}
            labelStyle={styles.buttonLabel}
          />
        </LinearGradient>
      </View>
    </Modal>
  );
}

const GOLD = '#F3D99B';
const VELVET = ['#3F0A1F', '#8E1B45', '#F2715E'] as const;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    card: {
      width: '100%',
      borderRadius: radius.lg + 8,
      borderWidth: 1.5,
      borderColor: GOLD,
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
      backgroundColor: 'rgba(243,217,155,0.16)',
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
    heartSeal: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 1.5,
      borderColor: GOLD,
      backgroundColor: 'rgba(20,11,16,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    flourish: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
    flourishLine: { width: 28, height: 1, backgroundColor: GOLD },
    flourishDiamond: { width: 6, height: 6, backgroundColor: GOLD, transform: [{ rotate: '45deg' }] },
    title: { ...typography.h1, fontSize: 34, lineHeight: 42, color: GOLD, marginTop: spacing.sm, textAlign: 'center' },
    subtitle: { ...typography.body, color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs, textAlign: 'center' },
    // Their portrait in a gold-framed Mughal arch; oversized top radii clamp to
    // a full crest.
    photoFrame: {
      marginTop: spacing.lg,
      padding: 4,
      borderWidth: 1.5,
      borderColor: GOLD,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md + 4,
      borderBottomRightRadius: radius.md + 4,
      ...glow('#000000', 0.3, 14, 10),
    },
    photo: {
      width: 110,
      height: 138,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    // A white pill with maroon ink on the velvet card.
    button: { marginTop: spacing.xl, width: '100%', borderColor: GOLD, backgroundColor: '#FFFFFF' },
    buttonLabel: { color: '#3F0A1F' },
  });
