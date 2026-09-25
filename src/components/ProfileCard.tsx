import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from './common/Badge';
import { useLanguage } from '../store/LanguageContext';
import { vocabularyLabel } from '../i18n/vocabulary';
import { useTheme } from '../store/ThemeContext';
import { radius, spacing, typography } from '../theme';
import { modeAccent } from '../theme/glow';
import { cardSurface } from '../theme/surfaces';
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
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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
          {name}
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
      ...cardSurface(colors),
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      paddingBottom: spacing.sm,
      paddingRight: spacing.md,
      marginBottom: spacing.md,
    },
    cardPressed: { opacity: 0.85 },
    // The portrait in a small Mughal arch; oversized top radii clamp to a crest.
    photoRim: {
      width: 70,
      height: 90,
      padding: 2,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.sm + 2,
      borderBottomRightRadius: radius.sm + 2,
    },
    photo: {
      width: '100%',
      height: '100%',
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.sm,
      borderBottomRightRadius: radius.sm,
      backgroundColor: colors.skeleton,
    },
    body: { flex: 1, marginLeft: spacing.md, gap: 4, alignItems: 'flex-start' },
    name: { ...typography.h3, color: colors.textPrimary },
    meta: { ...typography.caption, color: colors.textSecondary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
