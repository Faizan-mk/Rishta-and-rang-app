import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useLikeLimit } from '../../store/LikeLimitContext';
import { usePrivacy } from '../../store/PrivacyContext';
import { useMatches } from '../../store/MatchesContext';
import { oppositeGenderProfiles } from '../../utils/genderMatch';
import { isoToDisplay } from '../../utils/date';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'ExplorePlus'>;
type Plan = 'monthly' | 'yearly';

function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ExplorePlusScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser } = useAuth();
  const { notify, confirm } = useDialog();
  const { used, limit } = useLikeLimit();
  const { prefs } = usePrivacy();
  const { blockedProfiles } = useMatches();
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [plan, setPlan] = useState<Plan>('monthly');

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.sourceProfileId).filter(Boolean)),
    [blockedProfiles]
  );

  const admirers = useMemo(
    () =>
      prefs.profileVisible
        ? oppositeGenderProfiles(mockDiscoverProfiles, user?.gender)
            .filter((p) => !blockedProfileIds.has(p.id))
            .slice(0, 4)
        : [],
    [user?.gender, prefs.profileVisible, blockedProfileIds]
  );

  if (!user) return null;
  const isPro = Boolean(user.isExplorePlus);

  const onUpgrade = async () => {
    setUpgrading(true);
    await updateUser({
      ...user,
      isExplorePlus: true,
      subscriptionPlan: plan,
      subscriptionRenewsAt: isoDateInDays(plan === 'monthly' ? 30 : 365),
    });
    setUpgrading(false);
    await notify({ title: t('explorePlus.upgradeSuccessTitle'), message: t('explorePlus.upgradeSuccessBody') });
  };

  const onCancel = async () => {
    const confirmed = await confirm({
      title: t('explorePlus.cancelConfirmTitle'),
      message: t('explorePlus.cancelConfirmBody'),
      confirmLabel: t('explorePlus.cancelConfirmLabel'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    setCancelling(true);
    await updateUser({ ...user, isExplorePlus: false, subscriptionPlan: undefined, subscriptionRenewsAt: undefined });
    setCancelling(false);
    await notify({ title: t('explorePlus.cancelledTitle'), message: t('explorePlus.cancelledBody') });
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
          <View style={styles.planToggle}>
            <Pressable
              onPress={() => setPlan('monthly')}
              style={[styles.planOption, plan === 'monthly' && styles.planOptionSelected]}
            >
              <Text style={[styles.planLabel, plan === 'monthly' && styles.planLabelSelected]}>{t('explorePlus.monthly')}</Text>
              <Text style={[styles.planPrice, plan === 'monthly' && styles.planLabelSelected]}>{t('explorePlus.monthlyPrice')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setPlan('yearly')}
              style={[styles.planOption, plan === 'yearly' && styles.planOptionSelected]}
            >
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>{t('explorePlus.save25')}</Text>
              </View>
              <Text style={[styles.planLabel, plan === 'yearly' && styles.planLabelSelected]}>{t('explorePlus.yearly')}</Text>
              <Text style={[styles.planPrice, plan === 'yearly' && styles.planLabelSelected]}>{t('explorePlus.yearlyPrice')}</Text>
            </Pressable>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.featureText, rtl && styles.rtlText]}>{t('explorePlus.featureUnlimitedLikes')}</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.featureText, rtl && styles.rtlText]}>{t('explorePlus.featureSeeWhoLikedYou')}</Text>
          </View>

          <View style={styles.limitCard}>
            <Ionicons name="heart-outline" size={16} color={colors.teal} />
            <Text style={[styles.limitText, rtl && styles.rtlText]}>
              {t('explorePlus.dailyLikesRemaining', { used, limit })}
            </Text>
          </View>

          <Button label={t('explorePlus.upgrade')} onPress={onUpgrade} loading={upgrading} style={styles.upgradeButton} />
        </Animated.View>
      )}

      {isPro && (
        <Animated.View entering={FadeInUp.duration(360)} style={styles.manageCard}>
          <View style={styles.upgradedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.upgradedText}>{t('explorePlus.upgraded')}</Text>
          </View>

          <View style={styles.manageRow}>
            <Text style={[styles.manageLabel, rtl && styles.rtlText]}>{t('explorePlus.currentPlan')}</Text>
            <Text style={styles.manageValue}>
              {user.subscriptionPlan === 'yearly' ? t('explorePlus.yearly') : t('explorePlus.monthly')}
            </Text>
          </View>
          {user.subscriptionRenewsAt && (
            <View style={styles.manageRow}>
              <Text style={[styles.manageLabel, rtl && styles.rtlText]}>{t('explorePlus.renewsOn')}</Text>
              <Text style={styles.manageValue}>{isoToDisplay(user.subscriptionRenewsAt)}</Text>
            </View>
          )}
          <View style={styles.manageRow}>
            <Text style={[styles.manageLabel, rtl && styles.rtlText]}>{t('explorePlus.featureUnlimitedLikes')}</Text>
            <Text style={styles.manageValue}>{t('explorePlus.unlimitedLikes')}</Text>
          </View>

          <Button
            label={t('explorePlus.cancelSubscription')}
            variant="danger"
            onPress={onCancel}
            loading={cancelling}
            style={styles.cancelButton}
          />
        </Animated.View>
      )}

      <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('explorePlus.whoLikedYou')}</Text>
      {prefs.profileVisible ? (
        <>
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
        </>
      ) : (
        <View style={styles.hiddenCard}>
          <Ionicons name="eye-off-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.hiddenText, rtl && styles.rtlText]}>{t('explorePlus.hiddenWhileOff')}</Text>
        </View>
      )}
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
    planToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    planOption: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm,
      alignItems: 'center',
    },
    planOptionSelected: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
    planLabel: { ...typography.label, color: colors.textSecondary },
    planLabelSelected: { color: colors.teal },
    planPrice: { ...typography.h3, color: colors.textPrimary, marginTop: 2 },
    saveBadge: {
      position: 'absolute',
      top: -10,
      backgroundColor: colors.gold,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    saveBadgeText: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    featureText: { ...typography.body, color: colors.textPrimary },
    limitCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.tealSoft,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    limitText: { ...typography.caption, color: colors.teal, fontWeight: '700' },
    upgradeButton: { marginTop: spacing.sm },
    manageCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    upgradedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.successSoft,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    upgradedText: { ...typography.label, color: colors.success },
    manageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    manageLabel: { ...typography.body, color: colors.textSecondary },
    manageValue: { ...typography.bodyBold, color: colors.textPrimary },
    cancelButton: { marginTop: spacing.lg },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    admirerCard: { width: '47%', aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.skeleton },
    admirerPhoto: { width: '100%', height: '100%' },
    lockOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    admirerNameWrap: { position: 'absolute', bottom: spacing.xs, left: spacing.xs },
    admirerName: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
    lockedHint: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
    hiddenCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    hiddenText: { ...typography.body, color: colors.textSecondary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
