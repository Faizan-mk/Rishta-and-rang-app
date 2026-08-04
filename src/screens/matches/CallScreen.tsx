import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { AppStackScreenProps } from '../../navigation/types';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'Call'>;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CallScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useLanguage();
  const { name, photo } = route.params;

  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ringScale.value = withRepeat(withSequence(withTiming(1.35, { duration: 900, easing: Easing.out(Easing.ease) }), withTiming(1, { duration: 0 })), -1, false);
    ringOpacity.value = withRepeat(withSequence(withTiming(0, { duration: 900 }), withTiming(0.6, { duration: 0 })), -1, false);

    const connectAfter = setTimeout(() => setConnected(true), 1800);
    return () => clearTimeout(connectAfter);
  }, []);

  useEffect(() => {
    if (!connected) return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connected]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const endCall = () => navigation.goBack();

  return (
    <LinearGradient colors={[colors.tealDark, colors.background]} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.status}>{connected ? formatDuration(seconds) : t('call.ringing')}</Text>

          <View style={styles.avatarWrap}>
            {!connected && <Animated.View style={[styles.ring, ringStyle]} />}
            <Image source={{ uri: photo }} style={styles.avatar} />
          </View>

          <Text style={styles.name}>{name}</Text>
          <Text style={styles.hint}>{connected ? t('call.connected') : t('call.calling', { name })}</Text>
        </View>

        <View style={styles.controlsRow}>
          <CallControl icon={muted ? 'mic-off' : 'mic-outline'} active={muted} onPress={() => setMuted((m) => !m)} colors={colors} />
          <CallControl icon="volume-high" active={speaker} onPress={() => setSpeaker((s) => !s)} colors={colors} />
        </View>

        <Pressable onPress={endCall} style={styles.endButton}>
          <Ionicons name="call" size={26} color="#FFFFFF" style={styles.endIcon} />
        </Pressable>
        <Text style={styles.endLabel}>{t('call.end')}</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

function CallControl({
  icon,
  active,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  colors: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[controlStyles.button, { backgroundColor: active ? colors.teal : 'rgba(255,255,255,0.14)' }]}
    >
      <Ionicons name={icon} size={22} color="#FFFFFF" />
    </Pressable>
  );
}

const controlStyles = StyleSheet.create({
  button: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    status: { ...typography.label, color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
    avatarWrap: { marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', width: 168, height: 168, borderRadius: 84, borderWidth: 2, borderColor: '#FFFFFF' },
    avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
    name: { ...typography.h1, color: '#FFFFFF', marginTop: spacing.lg },
    hint: { ...typography.body, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xs },
    controlsRow: { flexDirection: 'row', gap: spacing.lg, alignSelf: 'center', marginBottom: spacing.xl },
    endButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    endIcon: { transform: [{ rotate: '135deg' }] },
    endLabel: { ...typography.caption, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
