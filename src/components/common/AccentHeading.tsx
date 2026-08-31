import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, typography } from '../../theme';
import type { Gradient } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface AccentHeadingProps {
  title: string;
  subtitle?: string;
  // The screen's own colour ramp, so a heading always belongs to its page.
  gradient: Gradient;
  // 'screen' is the page title, underscored by a gradient rule; 'section'
  // labels a block inside one, marked by a gradient tick to the side.
  size?: 'screen' | 'section';
  // Anything that sits opposite the title — a filter chip, an edit link.
  right?: React.ReactNode;
  style?: ViewStyle;
}

// One heading treatment shared by every list screen, so Explore, Messages and
// the profile pages read as chapters of the same book rather than three
// separately styled screens.
export function AccentHeading({ title, subtitle, gradient, size = 'section', right, style }: AccentHeadingProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (size === 'screen') {
    return (
      <View style={[styles.screenWrap, style]}>
        <View style={[styles.screenRow, rtl && styles.rowRtl]}>
          <View style={styles.screenText}>
            <Text style={[styles.screenTitle, rtl && styles.rtlText]}>{title}</Text>
            {subtitle ? <Text style={[styles.screenSubtitle, rtl && styles.rtlText]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        <LinearGradient colors={gradient} start={START} end={END} style={[styles.rule, rtl && styles.ruleRtl]} />
      </View>
    );
  }

  return (
    <View style={[styles.sectionRow, rtl && styles.rowRtl, style]}>
      <LinearGradient colors={gradient} start={START} end={VERTICAL_END} style={styles.tick} />
      <View style={styles.sectionText}>
        <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{title}</Text>
        {subtitle ? <Text style={[styles.sectionSubtitle, rtl && styles.rtlText]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const START = { x: 0, y: 0 } as const;
const END = { x: 1, y: 0 } as const;
const VERTICAL_END = { x: 0, y: 1 } as const;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    rowRtl: { flexDirection: 'row-reverse' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },

    screenWrap: { gap: spacing.sm },
    screenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    screenText: { flex: 1 },
    screenTitle: { ...typography.h1, color: colors.textPrimary, fontWeight: '800' },
    screenSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    rule: { width: 56, height: 4, borderRadius: 2 },
    ruleRtl: { alignSelf: 'flex-end' },

    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    tick: { width: 4, height: 22, borderRadius: radius.pill },
    sectionText: { flex: 1 },
    sectionTitle: { ...typography.h3, color: colors.textPrimary, fontWeight: '800' },
    sectionSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  });
