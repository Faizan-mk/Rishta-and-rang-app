import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface ProfileUtilityBarProps {
  liked: boolean;
  onShare: () => void;
  onToggleFavourite: () => void;
  onBlock: () => void;
  onReport: () => void;
}

// Quiet, borderless footer actions: a full-width share row, then the three
// per-profile controls people only reach for occasionally.
export function ProfileUtilityBar({ liked, onShare, onToggleFavourite, onBlock, onReport }: ProfileUtilityBarProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onShare} style={styles.shareRow}>
        <Ionicons name="share-social" size={19} color={colors.teal} />
        <Text style={styles.shareLabel}>{t('discover.shareProfile')}</Text>
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.utilityRow}>
        <UtilityAction
          icon={liked ? 'star' : 'star-outline'}
          label={liked ? t('discover.favourited') : t('discover.favourite')}
          onPress={onToggleFavourite}
          colors={colors}
          active={liked}
          pop
        />
        <UtilityAction icon="ban-outline" label={t('discover.block')} onPress={onBlock} colors={colors} />
        <UtilityAction icon="flag-outline" label={t('discover.report')} onPress={onReport} colors={colors} />
      </View>
    </View>
  );
}

function UtilityAction({
  icon,
  label,
  onPress,
  colors,
  active,
  pop,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: Palette;
  active?: boolean;
  pop?: boolean;
}) {
  const scale = useSharedValue(1);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Pop-bounce whenever an `active`-tracked button (Favourite) flips on, on top of
  // the normal press-in/out feedback every button gets.
  useEffect(() => {
    if (pop && active) {
      scale.value = withSequence(withSpring(1.35, { damping: 6, stiffness: 300 }), withSpring(1, { damping: 10, stiffness: 220 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.85, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 220 });
      }}
      style={styles.utilityButton}
    >
      <Animated.View
        style={[
          styles.utilityIcon,
          active && [{ backgroundColor: withAlpha(colors.gold, 0.16) }, glow(colors.gold, 0.4, 10, 3)],
          animatedStyle,
        ]}
      >
        <Ionicons name={icon} size={22} color={active ? colors.gold : colors.textPrimary} />
      </Animated.View>
      <Text style={[styles.utilityLabel, { color: active ? colors.gold : colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: spacing.xl },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: withAlpha(colors.teal, 0.3),
      backgroundColor: withAlpha(colors.teal, 0.08),
    },
    shareLabel: { ...typography.h3, color: colors.teal, fontWeight: '800' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
    utilityRow: { flexDirection: 'row', paddingVertical: spacing.sm },
    utilityButton: { flex: 1, alignItems: 'center', gap: spacing.sm },
    utilityIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
    },
    utilityLabel: { ...typography.body, fontWeight: '700' },
  });
