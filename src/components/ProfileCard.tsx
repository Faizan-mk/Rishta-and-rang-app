import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from './common/Badge';
import { useLanguage } from '../store/LanguageContext';
import { vocabularyLabel } from '../i18n/vocabulary';
import { useTheme } from '../store/ThemeContext';
import { radius, spacing, typography } from '../theme';
import { glow, modeAccent } from '../theme/glow';
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
  const accent = modeAccent(colors, kind);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, glow(accent.primary, 0.2, 14, 5), pressed && styles.cardPressed]}
    >
      {/* The photo's rim carries the mode, so a saved Friends profile and a
          saved Rishta profile are told apart before the badge is read. */}
      <LinearGradient
        colors={accent.ramp}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoRim}
      >
        <Image source={{ uri: photo }} style={styles.photo} />
      </LinearGradient>
      <View style={styles.body}>
        <Text style={[styles.name, rtl && styles.rtlText]}>
          {name}, {age}
        </Text>
        <Text style={[styles.meta, rtl && styles.rtlText]}>{vocabularyLabel(city, t)}</Text>
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
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    cardPressed: { opacity: 0.85 },
    photoRim: { width: 68, height: 84, borderRadius: radius.md + 2, padding: 2 },
    photo: { width: '100%', height: '100%', borderRadius: radius.md, backgroundColor: colors.skeleton },
    body: { flex: 1, marginLeft: spacing.md, gap: 4 },
    name: { ...typography.h3, color: colors.textPrimary, fontWeight: '800' },
    meta: { ...typography.caption, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
