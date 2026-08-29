import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from './common/Badge';
import { useLanguage } from '../store/LanguageContext';
import { useTheme } from '../store/ThemeContext';
import { radius, spacing, typography } from '../theme';
import type { Palette } from '../theme/palettes';
import type { ProfileMode } from '../types/user';

interface ProfileCardProps {
  photo: string;
  name: string;
  age: number;
  city: string;
  kind: ProfileMode;
  onPress: () => void;
  /** Trailing slot — a remove button, a like button, a menu. */
  action?: React.ReactNode;
}

// Compact horizontal profile card used by the saved/listing screens. The mode
// badge carries the same two labels the Home and Matches toggles use, so a
// profile reads as the same mode everywhere.
export function ProfileCard({ photo, name, age, city, kind, onPress, action }: ProfileCardProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <Image source={{ uri: photo }} style={styles.photo} />
      <View style={styles.body}>
        <Text style={[styles.name, rtl && styles.rtlText]}>
          {name}, {age}
        </Text>
        <Text style={[styles.meta, rtl && styles.rtlText]}>{city}</Text>
        <Badge
          label={t(kind === 'dating' ? 'profile.datingMode' : 'profile.rishtaMode')}
          tone={kind === 'dating' ? 'dating' : 'rishta'}
        />
      </View>
      {action}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    cardPressed: { opacity: 0.85 },
    photo: { width: 64, height: 80, borderRadius: radius.md, backgroundColor: colors.skeleton },
    body: { flex: 1, marginLeft: spacing.md, gap: 4 },
    name: { ...typography.h3, color: colors.textPrimary },
    meta: { ...typography.caption, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
