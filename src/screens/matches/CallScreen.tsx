import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import { glow } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CallScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const params = useLocalSearchParams<{ name: string; photo: string; video?: string }>();
  const { name, photo } = params;
  const video = params.video === '1';

  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (video && !permission?.granted) {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

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

  const endCall = () => router.back();
  const flipCamera = () => setFacing((f) => (f === 'front' ? 'back' : 'front'));

  const isVideo = Boolean(video);
  const showCamera = isVideo && permission?.granted;

  return (
    <View style={styles.flex}>
      {showCamera ? (
        <CameraView style={StyleSheet.absoluteFill} facing={facing} />
      ) : (
        <>
          {/* Their photo, blurred, under an aubergine-to-rosewood wash. Fixed
              colours: the call is always a dark room, whatever the theme. */}
          {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} blurRadius={28} /> : null}
          <LinearGradient
            colors={CALL_WASH}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {isVideo && !permission?.granted ? (
          <View style={styles.permissionWrap}>
            <Ionicons name="videocam-off-outline" size={40} color="rgba(255,255,255,0.8)" />
            <Text style={styles.permissionText}>{t('call.cameraPermission')}</Text>
            <Button
              label={t('call.grantAccess')}
              onPress={requestPermission}
              gradient={['#8E1B45', '#F2715E']}
              style={styles.permissionButton}
            />
          </View>
        ) : (
          <>
            <FadeIn style={showCamera ? styles.topBar : styles.center}>
              <Text style={[styles.status, showCamera && styles.statusOnCamera]}>
                {connected ? formatDuration(seconds) : t('call.ringing')}
              </Text>

              {!showCamera && (
                <View style={styles.avatarWrap}>
                  {!connected && <Animated.View style={[styles.ring, ringStyle]} />}
                  <Image source={{ uri: photo }} style={styles.avatar} />
                </View>
              )}

              <Text style={[styles.name, showCamera && styles.statusOnCamera]}>{name}</Text>
              <Text style={[styles.hint, showCamera && styles.hintOnCamera]}>
                {connected ? t('call.connected') : t('call.calling', { name })}
              </Text>
            </FadeIn>

            {showCamera && connected && (
              <FadeIn style={[styles.remoteTile, rtl && styles.remoteTileRtl]}>
                <Image source={{ uri: photo }} style={styles.remoteImage} />
              </FadeIn>
            )}

            <FadeIn delay={120} style={styles.controlsRow}>
              <CallControl icon={muted ? 'mic-off' : 'mic-outline'} active={muted} onPress={() => setMuted((m) => !m)} colors={colors} />
              {showCamera ? (
                <CallControl icon="camera-reverse-outline" active={false} onPress={flipCamera} colors={colors} />
              ) : (
                <CallControl icon="volume-high" active={speaker} onPress={() => setSpeaker((s) => !s)} colors={colors} />
              )}
            </FadeIn>

            <EndCallButton onPress={endCall} style={styles.endButton} />
            <Text style={styles.endLabel}>{t('call.end')}</Text>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 14, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={[
        controlStyles.button,
        active ? controlStyles.buttonActive : controlStyles.buttonIdle,
        animatedStyle,
      ]}
    >
      <Ionicons name={icon} size={22} color="#FFFFFF" />
    </AnimatedPressable>
  );
}

function EndCallButton({ onPress, style }: { onPress: () => void; style: ViewStyle }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 14, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={[style, animatedStyle]}
    >
      <Ionicons name="call" size={26} color="#FFFFFF" style={controlStyles.endIcon} />
    </AnimatedPressable>
  );
}

const GOLD = '#E9C27A';
const CALL_WASH = ['rgba(20,11,16,0.92)', 'rgba(94,15,46,0.82)', 'rgba(20,11,16,0.95)'] as const;

// Glass discs on the dark call room; a toggled control turns rosewood with a
// gold rim.
const controlStyles = StyleSheet.create({
  button: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonIdle: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.22)' },
  buttonActive: { backgroundColor: '#8E1B45', borderColor: GOLD },
  endIcon: { transform: [{ rotate: '135deg' }] },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topBar: { alignItems: 'center', paddingTop: spacing.lg },
    status: { ...typography.label, color: GOLD, letterSpacing: 1.6 },
    statusOnCamera: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
    avatarWrap: { marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center' },
    // The avatar and its ringing halo are both Mughal arches; the oversized
    // top radius is clamped to half the width, giving a full crest.
    ring: {
      position: 'absolute',
      width: 184,
      height: 220,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.lg + 12,
      borderBottomRightRadius: radius.lg + 12,
      borderWidth: 1.5,
      borderColor: GOLD,
      ...glow(GOLD, 0.5, 20, 0),
    },
    avatar: {
      width: 150,
      height: 186,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
      borderWidth: 2,
      borderColor: GOLD,
      backgroundColor: 'rgba(255,255,255,0.08)',
      ...glow('#8E1B45', 0.6, 24, 10),
    },
    name: { ...typography.h1, color: '#FFFFFF', marginTop: spacing.lg },
    hint: { ...typography.body, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xs },
    hintOnCamera: { color: 'rgba(255,255,255,0.85)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
    remoteTile: {
      position: 'absolute',
      top: spacing.xl + spacing.lg,
      right: spacing.md,
      width: 96,
      height: 128,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: GOLD,
      ...glow('#000000', 0.5, 14, 8),
    },
    remoteTileRtl: { right: undefined, left: spacing.md },
    remoteImage: { width: '100%', height: '100%' },
    controlsRow: { flexDirection: 'row', gap: spacing.lg, alignSelf: 'center', marginTop: 'auto', marginBottom: spacing.xl },
    endButton: {
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      ...glow(colors.danger, 0.7, 20, 10),
    },
    endLabel: { ...typography.label, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
    permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
    permissionText: { ...typography.body, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
    permissionButton: { marginTop: spacing.sm, alignSelf: 'stretch' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
