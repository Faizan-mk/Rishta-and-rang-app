import React, { useEffect, useMemo } from 'react';
import { DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Badge } from '../common/Badge';
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import type { ProfileMode } from '../../types/user';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { FEATURE_BUREAU } from '../../config/features';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MatchScoreCardProps {
  name: string;
  // 0-100 compatibility score from utils/compatibility.
  score: number;
  bureauVerified: boolean;
  // Colours the card with the deck the score was computed against.
  mode: ProfileMode;
  onPress: () => void;
}

// Sits directly under the photo: this app's own compatibility score, with the
// bureau badge alongside it, instead of a generic "upgrade" strip. The bar fills
// on arrival so the number lands as a result rather than as static furniture.
export function MatchScoreCard({ name, score, bureauVerified, mode, onPress }: MatchScoreCardProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const accent = modeAccent(colors, mode);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  const scale = useSharedValue(1);
  const fill = useSharedValue(0);
  // Light sweeping across the card, on a long cycle so it stays a shimmer.
  const sweep = useSharedValue(0);

  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(160, withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [clamped, fill]);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` as DimensionValue }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -200 + sweep.value * 520 }, { rotate: '18deg' }],
    opacity: sweep.value < 0.35 ? sweep.value : Math.max(0, 0.35 - (sweep.value - 0.35)),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 14, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={[styles.card, glow(accent.primary, 0.12, 24, 4), animatedStyle]}
    >
      <LinearGradient
        colors={[withAlpha(accent.primary, 0.1), withAlpha(accent.secondary, 0.06), 'transparent']}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={[styles.sweep, sweepStyle]} pointerEvents="none" />

      <View style={[styles.topRow, rtl && styles.rowRtl]}>
        <LinearGradient
          colors={accent.ramp}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={[styles.scoreBlock, glow(accent.primary, 0.35, 14, 6)]}
        >
          <Text style={styles.scoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {clamped}
          </Text>
          <Text style={styles.scoreUnit}>%</Text>
        </LinearGradient>

        <View style={styles.textBlock}>
          <Text style={[styles.title, rtl && styles.rtlText]}>{t('discover.matchScoreTitle')}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('discover.matchScoreSubtitle', { name })}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.trackFill, fillStyle]}>
          <LinearGradient colors={accent.ramp} start={GRADIENT_START} end={GRADIENT_END} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      {/* Wraps rather than squeezing: on a narrow phone the CTA drops onto its
          own line instead of the badge and the link colliding. */}
      <View style={[styles.footerRow, !FEATURE_BUREAU && styles.footerRowSolo, rtl && styles.rowRtl]}>
        {/* Shown only while the badge is earned by a real review — see
            FEATURE_BUREAU. Until then nothing checks anyone. */}
        {FEATURE_BUREAU && (
          <Badge
            label={bureauVerified ? t('profile.bureau') : t('profile.bureauNotVerified')}
            tone={bureauVerified ? 'success' : 'neutral'}
          />
        )}
        <View style={[styles.ctaRow, rtl && styles.rowRtl]}>
          <Text style={[styles.cta, { color: accent.primary }]} numberOfLines={1}>
            {t('discover.matchScoreCta')}
          </Text>
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={14} color={accent.primary} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.45),
      padding: spacing.md,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    sweep: {
      position: 'absolute',
      top: -40,
      bottom: -40,
      width: 70,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },
    rowRtl: { flexDirection: 'row-reverse' },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    // A round seal with a gold rim holding the score.
    scoreBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 74,
      height: 74,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.gold,
      paddingHorizontal: spacing.xs,
    },
    scoreValue: { color: '#FFFFFF', fontSize: scaleFont(28), fontFamily: fonts.display, lineHeight: scaleFont(34) },
    scoreUnit: { color: '#FFFFFF', fontSize: scaleFont(12), fontFamily: fonts.bodyBold, marginTop: 2 },
    textBlock: { flex: 1, gap: 2 },
    title: { ...typography.h3, color: colors.textPrimary },
    subtitle: { ...typography.caption, color: colors.textSecondary },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
    trackFill: { height: 6, borderRadius: 3, overflow: 'hidden' },
    footerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    // Without the badge beside it the CTA keeps its trailing position rather
    // than sliding to the start of an otherwise empty row.
    footerRowSolo: { justifyContent: 'flex-end' },
    ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
    cta: { ...typography.label, flexShrink: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
