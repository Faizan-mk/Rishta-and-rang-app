import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { radius, spacing, typography } from '../../theme';
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

export function ProfileUtilityBar({ liked, onShare, onToggleFavourite, onBlock, onReport }: ProfileUtilityBarProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.utilityRow}>
      <UtilityAction icon="share-outline" label={t('discover.share')} onPress={onShare} colors={colors} />
      <UtilityAction
        icon={liked ? 'star' : 'star-outline'}
        label={liked ? t('discover.favourited') : t('discover.favourite')}
        onPress={onToggleFavourite}
        colors={colors}
        active={liked}
        pop
      />
      <UtilityAction icon="hand-left-outline" label={t('discover.block')} onPress={onBlock} colors={colors} />
      <UtilityAction icon="flag-outline" label={t('discover.report')} onPress={onReport} colors={colors} />
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
      style={[styles.utilityButton, active && styles.utilityButtonActive]}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={icon} size={19} color={active ? colors.gold : colors.textSecondary} />
      </Animated.View>
      <Text style={[styles.utilityLabel, { color: active ? colors.gold : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    utilityRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
      marginTop: spacing.lg,
    },
    utilityButton: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: spacing.sm },
    utilityButtonActive: { backgroundColor: colors.goldSoft },
    utilityLabel: { ...typography.caption, fontWeight: '600' },
  });
