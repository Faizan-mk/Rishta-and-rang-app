import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, spacing, typography } from '../../theme';
import { scaleFont, scaleSpace } from '../../theme/responsive';
import { useTheme } from '../../store/ThemeContext';
import { flat } from '../../theme/glow';

interface WaveHeaderProps {
  title: string;
  subtitle?: string;
  // Shown in a frosted disc above the title (the logo, or the step's icon).
  badge?: React.ReactNode;
  onBack?: () => void;
  rtl?: boolean;
}

const WAVE_HEIGHT = scaleSpace(72);

// Full-bleed brand header for the auth screens: the maroon-to-rose ramp with a
// wavy lower edge melting into the page. There is no SVG in the app, so the
// wave is cut from ellipses (circles stretched with scaleX) painted in the page
// colour, with a translucent one behind them for the lighter second crest.
export function WaveHeader({ title, subtitle, badge, onBack, rtl }: WaveHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [width, setWidth] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  const w = width ?? window.width;

  return (
    <View onLayout={onLayout} style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={flat(colors.teal)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { paddingTop: insets.top + spacing.md }]}
      >
        {/* Soft bubbles, as on the reference design. */}
        <View pointerEvents="none" style={[styles.bubble, { width: w * 0.55, height: w * 0.55, top: -w * 0.18, right: -w * 0.14 }]} />
        <View pointerEvents="none" style={[styles.bubble, { width: w * 0.3, height: w * 0.3, top: w * 0.12, right: w * 0.16 }]} />

        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={[styles.back, rtl && styles.backRtl]}
            accessibilityRole="button"
          >
            <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View style={[styles.textBlock, rtl && styles.textBlockRtl]}>
          {badge ? <View style={styles.badge}>{badge}</View> : null}
          <Text style={[styles.title, rtl && styles.rtlText]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, rtl && styles.rtlText]}>{subtitle}</Text> : null}
        </View>

        <View pointerEvents="none" style={styles.wave}>
          <Ellipse cx={w * 0.4} top={scaleSpace(4)} width={w * 1.2} height={scaleSpace(220)} color="rgba(255,255,255,0.22)" />
          <Ellipse cx={w * 0.85} top={scaleSpace(14)} width={w * 1.3} height={scaleSpace(220)} color={colors.background} />
          <Ellipse cx={-w * 0.05} top={scaleSpace(46)} width={w * 0.95} height={scaleSpace(160)} color={colors.background} />
        </View>
      </LinearGradient>
    </View>
  );
}

function Ellipse({ cx, top, width, height, color }: { cx: number; top: number; width: number; height: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: cx - height / 2,
        top,
        width: height,
        height,
        borderRadius: height / 2,
        backgroundColor: color,
        transform: [{ scaleX: width / height }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  gradient: { overflow: 'hidden', paddingBottom: WAVE_HEIGHT },
  bubble: { position: 'absolute', borderRadius: 1000, backgroundColor: 'rgba(255,255,255,0.08)' },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
  },
  backRtl: { marginLeft: 0, marginRight: spacing.lg, alignSelf: 'flex-end' },
  textBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: 'center' },
  textBlockRtl: {},
  badge: {
    width: scaleSpace(56),
    height: scaleSpace(56),
    borderRadius: scaleSpace(28),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: scaleFont(32),
    lineHeight: scaleFont(40),
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.82)',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  rtlText: { writingDirection: 'rtl' },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: WAVE_HEIGHT, overflow: 'hidden' },
});
