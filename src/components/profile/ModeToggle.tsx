import React, { useEffect, useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { ProfileMode } from '../../types/user';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

interface ModeToggleProps {
  mode: ProfileMode;
  onChange: (mode: ProfileMode) => void;
  datingLabel: string;
  rishtaLabel: string;
}

export function ModeToggle({ mode, onChange, datingLabel, rishtaLabel }: ModeToggleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const width = useSharedValue(0);
  const thumbX = useSharedValue(0);

  useEffect(() => {
    thumbX.value = withSpring(mode === 'dating' ? 0 : width.value / 2, { damping: 18, stiffness: 220 });
  }, [mode, width.value]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    thumbX.value = mode === 'dating' ? 0 : e.nativeEvent.layout.width / 2;
  };

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
    backgroundColor: mode === 'dating' ? colors.dating : colors.rishta,
  }));

  return (
    <View style={styles.track} onLayout={onTrackLayout}>
      <Animated.View style={[styles.thumb, thumbStyle]} />
      <Pressable onPress={() => onChange('dating')} style={styles.option}>
        <Text style={[styles.label, mode === 'dating' && styles.labelActive]}>{datingLabel}</Text>
      </Pressable>
      <Pressable onPress={() => onChange('rishta')} style={styles.option}>
        <Text style={[styles.label, mode === 'rishta' && styles.labelActive]}>{rishtaLabel}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      padding: 4,
      position: 'relative',
    },
    thumb: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      width: '50%',
      borderRadius: radius.pill,
    },
    option: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    label: { ...typography.bodyBold, color: colors.textSecondary },
    labelActive: { color: colors.textInverse },
  });
