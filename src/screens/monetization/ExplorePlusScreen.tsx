import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/Button';
import { useBoost } from '../../store/BoostContext';
import { likesService, type LikeReceived } from '../../services/likesService';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useLikeLimit } from '../../store/LikeLimitContext';
import { usePrivacy } from '../../store/PrivacyContext';
import { useMatches } from '../../store/MatchesContext';
import { isoToDisplay } from '../../utils/date';
import { radius, spacing, typography } from '../../theme';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

type Plan = 'trial' | 'monthly' | 'yearly';

function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const PLAN_DAYS: Record<Plan, number> = { trial: 7, monthly: 30, yearly: 365 };

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
// Explore+ has its own colour identity — gold through ember into rose — so the
// paid surface never reads as just another mode-tinted screen.
const PLUS_RAMP = ['#F5C451', '#E8642E', '#D6407A'] as const;

// Profile boosts included with any paid plan.
const BOOSTS_PER_SUBSCRIPTION = 5;

export function ExplorePlusScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, updateUser } = useAuth();
  const { addBoosts } = useBoost();
  const { notify, confirm } = useDialog();
  const { used, limit } = useLikeLimit();
  const { prefs } = usePrivacy();
  const { blockedProfiles } = useMatches();
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [plan, setPlan] = useState<Plan>('monthly');
  const canTrial = !user?.hasUsedTrial;

  const blockedProfileIds = useMemo(
    () => new Set(blockedProfiles.map((b) => b.id)),
    [blockedProfiles]
  );

  // The real list, not a slice of the deck: members who actually liked this
  // profile, minus anyone since blocked.
  const [admirers, setAdmirers] = useState<LikeReceived[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    likesService
      .fetchLikesReceived(user.id)
      .then((rows) => {
        if (!cancelled) setAdmirers(rows.filter((row) => !blockedProfileIds.has(row.id)).slice(0, 4));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.id, blockedProfileIds]);

  if (!user) return null;
  const isPro = Boolean(user.isExplorePlus);

  const onUpgrade = async () => {
    setUpgrading(true);
    // Since supabase/29_entitlements.sql these columns are pinned against a
    // member's own writes, so this no longer grants anything — the tier is
    // granted by a receipt-validating function, which real billing has yet to
    // be wired to. The write is left in place for when it is; what changed is
    // that the screen no longer claims success it did not get.
    const saved = await updateUser({
      ...user,
      isExplorePlus: true,
      subscriptionPlan: plan,
      subscriptionRenewsAt: isoDateInDays(PLAN_DAYS[plan]),
      hasUsedTrial: user.hasUsedTrial || plan === 'trial',
    });
    setUpgrading(false);

    if (!saved.isExplorePlus) {
      await notify({
        title: t('explorePlus.billingPendingTitle'),
        message: t('explorePlus.billingPendingBody'),
      });
      return;
    }

    // A subscription comes with a pack of profile boosts — this is what the
    // boost sheet's "Get more Boosts" button sends members here for.
    addBoosts(BOOSTS_PER_SUBSCRIPTION);
    await notify({
      title: t('explorePlus.upgradeSuccessTitle'),
      message: plan === 'trial' ? t('explorePlus.trialStartedBody') : t('explorePlus.upgradeSuccessBody'),
    });
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
      <LinearGradient
        colors={PLUS_RAMP}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={[styles.hero, glow(colors.gold, 0.5, 24, 10)]}
      >
        <View style={styles.heroGlowA} pointerEvents="none" />
        <View style={styles.heroGlowB} pointerEvents="none" />
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={26} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>{t('explorePlus.title')}</Text>
        <Text style={styles.heroSubtitle}>{t('explorePlus.subtitle')}</Text>
      </LinearGradient>

      {!isPro && (
        <Animated.View entering={FadeInUp.duration(360)} style={styles.priceCard}>
          <View style={styles.planToggle}>
            {canTrial && (
              <Pressable
                onPress={() => setPlan('trial')}
                style={[styles.planOption, plan === 'trial' && styles.planOptionSelected]}
              >
                <View style={[styles.saveBadge, styles.trialBadge]}>
                  <Text style={styles.saveBadgeText}>{t('explorePlus.trialBadge')}</Text>
                </View>
                <Text style={[styles.planLabel, plan === 'trial' && styles.planLabelSelected]}>{t('explorePlus.trial')}</Text>
                <Text style={[styles.planPrice, plan === 'trial' && styles.planLabelSelected]}>{t('explorePlus.trialPrice')}</Text>
              </Pressable>
            )}
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
          {plan === 'trial' && (
            <Text style={[styles.trialHint, rtl && styles.rtlText]}>{t('explorePlus.trialHint')}</Text>
          )}

          <View style={[styles.featureRow, rtl && styles.rowRtl]}>
            <View style={styles.featureTick}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={[styles.featureText, rtl && styles.rtlText]}>{t('explorePlus.featureUnlimitedLikes')}</Text>
          </View>
          <View style={[styles.featureRow, rtl && styles.rowRtl]}>
            <View style={styles.featureTick}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
            <Text style={[styles.featureText, rtl && styles.rtlText]}>{t('explorePlus.featureSeeWhoLikedYou')}</Text>
          </View>

          <View style={styles.limitCard}>
            <Ionicons name="heart-outline" size={16} color={colors.teal} />
            <Text style={[styles.limitText, rtl && styles.rtlText]}>
              {t('explorePlus.dailyLikesRemaining', { used, limit })}
            </Text>
          </View>

          <Button
            label={plan === 'trial' ? t('explorePlus.startTrial') : t('explorePlus.upgrade')}
            onPress={onUpgrade}
            loading={upgrading}
            gradient={PLUS_RAMP}
            style={styles.upgradeButton}
          />
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
              {user.subscriptionPlan === 'yearly'
                ? t('explorePlus.yearly')
                : user.subscriptionPlan === 'trial'
                ? t('explorePlus.trial')
                : t('explorePlus.monthly')}
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

      <AccentHeading title={t('explorePlus.whoLikedYou')} gradient={PLUS_RAMP} style={styles.sectionHeading} />
      {prefs.profileVisible ? (
        <>
          <View style={styles.grid}>
            {admirers.map((profile) => (
              <LinearGradient
                key={profile.id}
                colors={PLUS_RAMP}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.admirerRim, glow(colors.gold, 0.3, 12, 5)]}
              >
                <View style={styles.admirerCard}>
                <Image source={{ uri: profile.photo }} style={styles.admirerPhoto} />
                {!isPro && (
                  <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                    </View>
                  </BlurView>
                )}
                {isPro && (
                  <View style={styles.admirerNameWrap}>
                    <Text style={styles.admirerName}>{profile.name}</Text>
                  </View>
                )}
                </View>
              </LinearGradient>
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
    hero: {
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    // Blown-out highlights inside the hero, so the ramp reads as lit rather
    // than as a flat sweep of three colours.
    heroGlowA: {
      position: 'absolute',
      top: -70,
      left: -30,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroGlowB: {
      position: 'absolute',
      bottom: -90,
      right: -20,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { ...typography.h1, color: '#FFFFFF', marginTop: spacing.sm, fontWeight: '800' },
    heroSubtitle: { ...typography.body, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: spacing.xs },
    rowRtl: { flexDirection: 'row-reverse' },
    priceCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    planToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    planOption: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
    },
    planOptionSelected: {
      borderColor: colors.gold,
      backgroundColor: withAlpha(colors.gold, 0.12),
      ...glow(colors.gold, 0.35, 12, 5),
    },
    planLabel: { ...typography.label, color: colors.textSecondary, fontWeight: '700' },
    planLabelSelected: { color: colors.gold },
    planPrice: { ...typography.h3, color: colors.textPrimary, marginTop: 2, fontWeight: '800' },
    saveBadge: {
      position: 'absolute',
      top: -10,
      backgroundColor: colors.gold,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    saveBadgeText: { ...typography.caption, color: '#FFFFFF', fontWeight: '800' },
    trialBadge: { backgroundColor: colors.success },
    trialHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xs, marginBottom: spacing.md },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    featureTick: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      ...glow(colors.success, 0.5, 8, 3),
    },
    featureText: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
    limitCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: withAlpha(colors.teal, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.teal, 0.3),
      borderRadius: radius.md,
      padding: spacing.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    limitText: { ...typography.caption, color: colors.teal, fontWeight: '800' },
    upgradeButton: { marginTop: spacing.sm },
    manageCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
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
    upgradedText: { ...typography.label, color: colors.success, fontWeight: '800' },
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
    sectionHeading: { marginBottom: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    admirerRim: { width: '47%', borderRadius: radius.md + 2, padding: 2 },
    admirerCard: { aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.skeleton },
    admirerPhoto: { width: '100%', height: '100%' },
    lockOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    admirerNameWrap: { position: 'absolute', bottom: spacing.xs, left: spacing.xs },
    admirerName: { ...typography.caption, color: '#FFFFFF', fontWeight: '800' },
    lockedHint: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
    hiddenCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    hiddenText: { ...typography.body, color: colors.textSecondary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
