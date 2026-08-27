import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Badge } from '../common/Badge';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MatchScoreCardProps {
  name: string;
  // 0-100 compatibility score from utils/compatibility.
  score: number;
  bureauVerified: boolean;
  onPress: () => void;
}

// Sits directly under the photo: this app's own compatibility score, with the
// bureau badge alongside it, instead of a generic "upgrade" strip.
export function MatchScoreCard({ name, score, bureauVerified, onPress }: MatchScoreCardProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 14, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={[styles.card, animatedStyle]}
    >
      <View style={[styles.topRow, rtl && styles.rowRtl]}>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {clamped}
          </Text>
          <Text style={styles.scoreUnit}>%</Text>
        </View>

        <View style={styles.textBlock}>
          <Text style={[styles.title, rtl && styles.rtlText]}>{t('discover.matchScoreTitle')}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('discover.matchScoreSubtitle', { name })}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${clamped}%` }]} />
      </View>

      {/* Wraps rather than squeezing: on a narrow phone the CTA drops onto its
          own line instead of the badge and the link colliding. */}
      <View style={[styles.footerRow, rtl && styles.rowRtl]}>
        <Badge
          label={bureauVerified ? t('profile.bureau') : t('profile.bureauNotVerified')}
          tone={bureauVerified ? 'success' : 'neutral'}
        />
        <View style={[styles.ctaRow, rtl && styles.rowRtl]}>
          <Text style={styles.cta} numberOfLines={1}>
            {t('discover.matchScoreCta')}
          </Text>
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.gold} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.goldSoft,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.gold,
      padding: spacing.md,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    scoreBlock: { flexDirection: 'row', alignItems: 'flex-start', minWidth: 62 },
    scoreValue: { color: colors.gold, fontSize: scaleFont(34), fontWeight: '800', lineHeight: scaleFont(38) },
    scoreUnit: { color: colors.gold, fontSize: scaleFont(14), fontWeight: '800', marginTop: 5 },
    textBlock: { flex: 1, gap: 2 },
    title: { ...typography.h3, color: colors.textPrimary },
    subtitle: { ...typography.caption, color: colors.textSecondary },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
    trackFill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
    footerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
    cta: { ...typography.caption, color: colors.gold, fontWeight: '800', flexShrink: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
