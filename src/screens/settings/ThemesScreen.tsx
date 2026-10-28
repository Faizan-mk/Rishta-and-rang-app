import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { fonts, radius, spacing, typography } from '../../theme';
import { flat, glow, withAlpha } from '../../theme/glow';
import { APP_THEME_IDS, APP_THEMES, type AppThemeId, type Palette } from '../../theme/palettes';

const THEME_LABELS: Record<AppThemeId, { nameKey: string; descKey: string }> = {
  maroon: { nameKey: 'settings.themeMaroon', descKey: 'settings.themeMaroonDesc' },
  emerald: { nameKey: 'settings.themeEmerald', descKey: 'settings.themeEmeraldDesc' },
  navy: { nameKey: 'settings.themeNavy', descKey: 'settings.themeNavyDesc' },
  onyx: { nameKey: 'settings.themeOnyx', descKey: 'settings.themeOnyxDesc' },
  pink: { nameKey: 'settings.themePink', descKey: 'settings.themePinkDesc' },
};

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

export function ThemesScreen() {
  const { colors, isDark, themeId, setThemeId } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    // The stack draws the header, so only the bottom inset is ours (same as Settings).
    <ScreenContainer edges={['bottom']}>
      {/* The stack header already says "Themes"; the list starts straight under it. */}
      {APP_THEME_IDS.map((id, index) => {
        // Preview each theme in the mode the app is in right now, so what the
        // card shows is what tapping it gives.
        const preview = isDark ? APP_THEMES[id].dark : APP_THEMES[id].light;
        const selected = themeId === id;
        const labels = THEME_LABELS[id];
        return (
          <FadeIn key={id} delay={60 + index * 50}>
            <Pressable
              onPress={() => setThemeId(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.card,
                selected && [styles.cardSelected, glow(colors.teal, 0.25, 14, 4)],
                pressed && styles.cardPressed,
              ]}
            >
              <ThemePreview palette={preview} />

              <View style={[styles.infoRow, rtl && styles.infoRowRtl]}>
                <View style={styles.swatches}>
                  {[preview.brandMain, preview.brandRose, preview.metal].map((swatch) => (
                    <View key={swatch} style={[styles.swatch, { backgroundColor: swatch }]} />
                  ))}
                </View>
                <View style={styles.textWrap}>
                  <Text style={[styles.name, rtl && styles.rtlText]}>{t(labels.nameKey)}</Text>
                  <Text style={[styles.desc, rtl && styles.rtlText]}>{t(labels.descKey)}</Text>
                </View>
                {selected ? (
                  <View style={styles.activeBadge}>
                    <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                    <Text style={styles.activeLabel}>{t('settings.themeActive')}</Text>
                  </View>
                ) : (
                  <View style={styles.radio} />
                )}
              </View>
            </Pressable>
          </FadeIn>
        );
      })}
    </ScreenContainer>
  );
}

// A thumbnail of the app in the given palette: the velvet hero, a card on the
// canvas and a primary button.
function ThemePreview({ palette }: { palette: Palette }) {
  return (
    <View style={[previewStyles.canvas, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <LinearGradient
        colors={flat(palette.brandMain)}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={previewStyles.hero}
      >
        <Ionicons name="heart" size={16} color={palette.metalBright} />
        <View style={[previewStyles.heroLine, { backgroundColor: withAlpha(palette.metalBright, 0.8) }]} />
      </LinearGradient>
      <View style={previewStyles.body}>
        <View style={[previewStyles.miniCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[previewStyles.avatar, { backgroundColor: palette.tealSoft, borderColor: palette.gold }]} />
          <View style={previewStyles.lines}>
            <View style={[previewStyles.line, { backgroundColor: palette.textPrimary, width: '70%' }]} />
            <View style={[previewStyles.line, { backgroundColor: palette.textTertiary, width: '45%' }]} />
          </View>
        </View>
        <View style={[previewStyles.button, { backgroundColor: palette.teal }]} />
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  canvas: { height: 132, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  hero: { height: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  heroLine: { height: 4, width: 64, borderRadius: 2 },
  body: { flex: 1, padding: spacing.sm, gap: spacing.sm, justifyContent: 'space-between' },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  avatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  lines: { flex: 1, gap: 5 },
  line: { height: 4, borderRadius: 2, opacity: 0.85 },
  button: { height: 14, borderRadius: radius.pill, width: '55%', alignSelf: 'center' },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    cardSelected: { borderColor: colors.teal },
    cardPressed: { opacity: 0.85 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xs, paddingTop: spacing.sm },
    infoRowRtl: { flexDirection: 'row-reverse' },
    swatches: { flexDirection: 'row' },
    swatch: { width: 18, height: 18, borderRadius: 9, marginRight: -6, borderWidth: 2, borderColor: colors.surface },
    textWrap: { flex: 1, marginLeft: spacing.xs },
    name: { ...typography.label, color: colors.textPrimary, fontFamily: fonts.bodyBold },
    desc: { ...typography.caption, color: colors.textSecondary },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.teal,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    activeLabel: { ...typography.caption, color: colors.textInverse, fontFamily: fonts.bodyBold },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
