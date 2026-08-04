import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { AppStackScreenProps } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { mockDiscoverProfiles } from '../../data/mockDiscover';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'ExplorePlus'>;

export function ExplorePlusScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser } = useAuth();
  const { notify } = useDialog();
  const [upgrading, setUpgrading] = useState(false);

  const admirers = useMemo(
    () => oppositeGenderProfiles(mockDiscoverProfiles, user?.gender).slice(0, 4),
    [user?.gender]
  );

  if (!user) return null;
  const isPro = Boolean(user.isExplorePlus);

  const onUpgrade = async () => {
    setUpgrading(true);
    await updateUser({ ...user, isExplorePlus: true });
    setUpgrading(false);
    await notify({ title: t('explorePlus.upgradeSuccessTitle'), message: t('explorePlus.upgradeSuccessBody') });
  };

  return (
    <ScreenContainer>
      <LinearGradient colors={[colors.gold, colors.dating]} style={styles.hero}>
        <Ionicons name="sparkles" size={28} color="#FFFFFF" />
        <Text style={styles.heroTitle}>{t('explorePlus.title')}</Text>
        <Text style={styles.heroSubtitle}>{t('explorePlus.subtitle')}</Text>
      </LinearGradient>

      {!isPro && (
        <Animated.View entering={FadeInUp.duration(360)} style={styles.priceCard}>
          <Text style={[styles.price, rtl && styles.rtlText]}>{t('explorePlus.price')}</Text>
          <View style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.featureText, rtl && styles.rtlText]}>{t('explorePlus.featureUnlimitedLikes')}</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.featureText, rtl && styles.rtlText]}>{t('explorePlus.featureSeeWhoLikedYou')}</Text>
          </View>
          <Button label={t('explorePlus.upgrade')} onPress={onUpgrade} loading={upgrading} style={styles.upgradeButton} />
        </Animated.View>
      )}

      {isPro && (
        <View style={styles.upgradedBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.upgradedText}>{t('explorePlus.upgraded')}</Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('explorePlus.whoLikedYou')}</Text>
      <View style={styles.grid}>
        {admirers.map((profile) => (
          <View key={profile.id} style={styles.admirerCard}>
            <Image source={{ uri: profile.photos[0] }} style={styles.admirerPhoto} />
            {!isPro && (
              <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                </View>
              </BlurView>
            )}
            {isPro && (
              <View style={styles.admirerNameWrap}>
                <Text style={styles.admirerName}>{profile.name}, {profile.age}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      {!isPro && <Text style={[styles.lockedHint, rtl && styles.rtlText]}>{t('explorePlus.lockedHint')}</Text>}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    hero: { borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
    heroTitle: { ...typography.h1, color: '#FFFFFF', marginTop: spacing.sm },
    heroSubtitle: { ...typography.body, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: spacing.xs },
    priceCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    price: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    featureText: { ...typography.body, color: colors.textPrimary },
    upgradeButton: { marginTop: spacing.md },
    upgradedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.successSoft,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.lg,
    },
    upgradedText: { ...typography.label, color: colors.success },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    admirerCard: { width: '47%', aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.skeleton },
    admirerPhoto: { width: '100%', height: '100%' },
    lockOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    admirerNameWrap: { position: 'absolute', bottom: spacing.xs, left: spacing.xs },
    admirerName: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
    lockedHint: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
