import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  right?: 'chevron' | 'switch';
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  onPress?: () => void;
}

export function SettingsRow({ icon, label, description, right, switchValue, onSwitchChange, onPress }: SettingsRowProps) {
  const { colors } = useTheme();
  const { rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const content = (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      {icon && (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.textWrap}>
        <Text style={[styles.label, rtl && styles.rtlText]}>{label}</Text>
        {description && <Text style={[styles.description, rtl && styles.rtlText]}>{description}</Text>}
      </View>
      {right === 'switch' && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      )}
      {right === 'chevron' && <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 16, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        }}
        style={animatedStyle}
      >
        {content}
      </AnimatedPressable>
    );
  }
  return content;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
    rowRtl: { flexDirection: 'row-reverse' },
    iconWrap: { width: 28, alignItems: 'center' },
    textWrap: { flex: 1 },
    label: { ...typography.body, color: colors.textPrimary },
    description: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
