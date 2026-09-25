import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/Button';
import { useBoost } from '../../store/BoostContext';
import { likesService, type LikeReceived } from '../../services/likesService';
import {
  fetchExplorePlusPackages,
  purchaseExplorePlus,
  syncExplorePlusEntitlement,
  PurchaseCancelledError,
  type ExplorePlusPackages,
} from '../../services/billingService';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useLikeLimit } from '../../store/LikeLimitContext';
import { usePrivacy } from '../../store/PrivacyContext';
import { useMatches } from '../../store/MatchesContext';
import { isoToDisplay } from '../../utils/date';
import { errorMessage } from '../../utils/appError';
import { fonts, radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

type Plan = 'trial' | 'monthly' | 'yearly';

/** Google Play's account-management page for this app — RevenueCat's REST API
 *  can validate a subscription but cannot cancel one, and it shouldn't: the
 *  member's own Play account is the one place that actually is the billing
 *  relationship. */
const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions?package=com.rishtaandrang.app';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
// Explore+ has its own colour identity — gold through ember into rose — so the
// paid surface never reads as just another mode-tinted screen.
const PLUS_RAMP = ['#F3D99B', '#D4A857', '#B8893A'] as const;
// The premium room: deep maroon velvet under champagne gold, fixed in both
// themes so the gold always has something dark to shine against.
const VELVET_RAMP = ['#3F0A1F', '#5E0F2E', '#8E1B45'] as const;
const CHAMPAGNE = '#F3D99B';
const MAROON_INK = '#3F0A1F';

// Profile boosts included with any paid plan.
const BOOSTS_PER_SUBSCRIPTION = 5;

export function ExplorePlusScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user, refreshUser } = useAuth();
  const { addBoosts } = useBoost();
  const { notify } = useDialog();
  const { used, limit } = useLikeLimit();
  const { prefs } = usePrivacy();
  const { blockedProfiles } = useMatches();
  const [upgrading, setUpgrading] = useState(false);
  const [plan, setPlan] = useState<Plan>('monthly');
  const canTrial = !user?.hasUsedTrial;

  // Fetched once per visit — the only place that knows Google Play's actual
  // packages for this build. Null on a build with no RevenueCat key, in Expo
  // Go, or on a platform other than Android (see billingService).
  const [packages, setPackages] = useState<ExplorePlusPackages | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchExplorePlusPackages()
      .then((result) => {
        if (!cancelled) setPackages(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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

  // "trial" buys the same package as "monthly" — a trial is a free phase of
  // that base plan in Play Console, not a separate product. Play itself
  // decides whether this member is actually eligible for it.
  const onUpgrade = async () => {
    const pkg = packages && (plan === 'yearly' ? packages.yearly : packages.monthly);
    if (!pkg) {
      await notify({ title: t('explorePlus.billingPendingTitle'), message: t('explorePlus.billingPendingBody') });
      return;
    }

    setUpgrading(true);
    try {
      // The purchase only unlocks the ask — sync-entitlement is what actually
      // checks RevenueCat's record and calls grant_explore_plus
      // (supabase/29_entitlements.sql), which is the only thing this screen
      // trusts to say the tier really took.
      const purchased = await purchaseExplorePlus(pkg);
      if (!purchased) {
        await notify({ title: t('explorePlus.billingPendingTitle'), message: t('explorePlus.billingPendingBody') });
        return;
      }
      await syncExplorePlusEntitlement();
      const fresh = await refreshUser();

      if (!fresh?.isExplorePlus) {
        await notify({ title: t('explorePlus.billingPendingTitle'), message: t('explorePlus.billingPendingBody') });
        return;
      }

      // A subscription comes with a pack of profile boosts — this is what the
      // boost sheet's "Get more Boosts" button sends members here for.
      addBoosts(BOOSTS_PER_SUBSCRIPTION);
      await notify({
        title: t('explorePlus.upgradeSuccessTitle'),
        message: plan === 'trial' ? t('explorePlus.trialStartedBody') : t('explorePlus.upgradeSuccessBody'),
      });
    } catch (e) {
      if (e instanceof PurchaseCancelledError) return;
      await notify({ title: t('common.somethingWentWrong'), message: errorMessage(e, t) });
    } finally {
      setUpgrading(false);
    }
  };

  // Our backend can tell whether a subscription is active; it cannot cancel
  // one — the member's own Play account is the actual billing relationship,
  // and that is the one place a cancellation is real.
  const onManage = async () => {
    const canOpen = await Linking.canOpenURL(PLAY_SUBSCRIPTIONS_URL).catch(() => false);
    if (!canOpen) {
      await notify({ title: t('explorePlus.title'), message: t('common.linkUnavailable') });
      return;
    }
    await Linking.openURL(PLAY_SUBSCRIPTIONS_URL);
  };

  return (
    <ScreenContainer>
      <LinearGradient
        colors={VELVET_RAMP}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={[styles.hero, glow('#8E1B45', 0.35, 24, 10)]}
      >
        <View style={styles.heroGlowA} pointerEvents="none" />
        <View style={styles.heroGlowB} pointerEvents="none" />
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={26} color={CHAMPAGNE} />
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
                  <Text style={styles.saveBadgeText} numberOfLines={1}>{t('explorePlus.trialBadge')}</Text>
                </View>
                <Text
                  style={[styles.planLabel, plan === 'trial' && styles.planLabelSelected]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {t('explorePlus.trial')}
                </Text>
                <Text
                  style={[styles.planPrice, plan === 'trial' && styles.planLabelSelected]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {t('explorePlus.trialPrice')}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setPlan('monthly')}
              style={[styles.planOption, plan === 'monthly' && styles.planOptionSelected]}
            >
              <Text
                style={[styles.planLabel, plan === 'monthly' && styles.planLabelSelected]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t('explorePlus.monthly')}
              </Text>
              <Text
                style={[styles.planPrice, plan === 'monthly' && styles.planLabelSelected]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {packages?.monthly?.product.priceString ?? t('explorePlus.monthlyPrice')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPlan('yearly')}
              style={[styles.planOption, plan === 'yearly' && styles.planOptionSelected]}
            >
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText} numberOfLines={1}>{t('explorePlus.save25')}</Text>
              </View>
              <Text
                style={[styles.planLabel, plan === 'yearly' && styles.planLabelSelected]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t('explorePlus.yearly')}
              </Text>
              <Text
                style={[styles.planPrice, plan === 'yearly' && styles.planLabelSelected]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {packages?.yearly?.product.priceString ?? t('explorePlus.yearlyPrice')}
              </Text>
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
            labelStyle={styles.upgradeLabel}
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
            label={t('explorePlus.manageSubscription')}
            variant="secondary"
            onPress={onManage}
            style={styles.cancelButton}
            labelStyle={styles.cancelLabel}
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
                style={[styles.admirerRim, glow(colors.gold, 0.2, 12, 4)]}
              >
                <View style={styles.admirerCard}>
                <Image source={{ uri: profile.photo }} style={styles.admirerPhoto} />
                {!isPro && (
                  // Android's BlurView renders as a flat, un-blurred tint
                  // unless this is set — it defaults to 'none' there, unlike
                  // iOS where the native blur just works.
                  <BlurView
                    intensity={40}
                    tint={isDark ? 'dark' : 'light'}
                    experimentalBlurMethod="dimezisBlurView"
                    style={StyleSheet.absoluteFill}
                  >
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
      borderWidth: 1.5,
      borderColor: CHAMPAGNE,
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
      backgroundColor: 'rgba(243,217,155,0.14)',
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
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(20,11,16,0.3)',
      borderWidth: 1.5,
      borderColor: CHAMPAGNE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { ...typography.h1, fontSize: 34, lineHeight: 42, color: CHAMPAGNE, marginTop: spacing.sm },
    heroSubtitle: { ...typography.body, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: spacing.xs },
    rowRtl: { flexDirection: 'row-reverse' },
    priceCard: {
      ...cardSurface(colors),
      borderColor: withAlpha(colors.gold, 0.5),
      padding: spacing.lg,
      paddingBottom: spacing.lg,
      marginBottom: spacing.lg,
    },
    planToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    planOption: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xs,
      // Extra top clearance (beyond the bottom padding) for the badge that floats
      // above this box — three options sharing one row on a narrow phone leaves
      // little width, so the badge's own text sits right at the edge of wrapping,
      // and a wrapped second line needs somewhere to go without covering the
      // label/price text right below it.
      paddingTop: spacing.md + spacing.xs,
      paddingBottom: spacing.sm + 2,
      alignItems: 'center',
    },
    // Border only — the translucent gold fill plus drop-shadow this used to carry
    // rendered as a hard, offset rectangle over the label/price text on some
    // Android devices instead of a soft tint, so selection is shown with just a
    // thicker, coloured border now.
    // A solid (not translucent) champagne fill is safe here — it was the
    // translucent fill plus a shadow that drew the hard rectangle.
    planOptionSelected: {
      borderWidth: 2,
      borderColor: colors.gold,
      backgroundColor: colors.goldSoft,
    },
    planLabel: { ...typography.label, color: colors.textSecondary },
    planLabelSelected: { color: colors.teal },
    planPrice: { ...typography.h3, color: colors.textPrimary, marginTop: 2 },
    saveBadge: {
      position: 'absolute',
      top: -10,
      maxWidth: '92%',
      backgroundColor: colors.gold,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    // Smaller than typography.caption and forced to one line (see numberOfLines
    // on the Text itself) — at caption size "7 days free" wraps to two lines in
    // the trial column when three plan options share a phone-width row, which is
    // what let this badge grow tall enough to cover the label below it.
    saveBadgeText: { fontSize: 10, lineHeight: 13, color: '#FFFFFF', fontFamily: fonts.bodyBold },
    trialBadge: { backgroundColor: colors.success },
    trialHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xs, marginBottom: spacing.md },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    featureTick: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
    limitCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.tealSoft,
      borderWidth: 1,
      borderColor: withAlpha(colors.teal, 0.18),
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      padding: spacing.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    limitText: { ...typography.caption, color: colors.teal, fontFamily: fonts.bodyBold, flexShrink: 1 },
    upgradeButton: { marginTop: spacing.sm, borderWidth: 1, borderColor: '#B8893A' },
    upgradeLabel: { color: MAROON_INK },
    manageCard: {
      ...cardSurface(colors),
      borderColor: withAlpha(colors.gold, 0.5),
      padding: spacing.lg,
      paddingBottom: spacing.lg,
      marginBottom: spacing.lg,
    },
    upgradedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.successSoft,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    upgradedText: { ...typography.label, color: colors.success, fontFamily: fonts.bodyBold },
    manageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm + 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    manageLabel: { ...typography.body, color: colors.textSecondary },
    manageValue: { ...typography.bodyBold, color: colors.textPrimary },
    cancelButton: { marginTop: spacing.lg, borderColor: colors.gold, backgroundColor: 'transparent' },
    cancelLabel: { color: colors.textPrimary },
    sectionHeading: { marginBottom: spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, justifyContent: 'space-between' },
    // Gold-rimmed Mughal arches; oversized top radii clamp to a full crest.
    admirerRim: {
      width: '48%',
      padding: 2,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md + 2,
      borderBottomRightRadius: radius.md + 2,
    },
    admirerCard: {
      aspectRatio: 3 / 4,
      borderTopLeftRadius: 1000,
      borderTopRightRadius: 1000,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    admirerPhoto: { width: '100%', height: '100%' },
    lockOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    admirerNameWrap: { position: 'absolute', bottom: spacing.sm, left: spacing.sm },
    admirerName: { ...typography.h3, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
    lockedHint: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
    hiddenCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      ...cardSurface(colors),
      padding: spacing.md,
      paddingBottom: spacing.md,
      marginBottom: spacing.lg,
    },
    hiddenText: { ...typography.body, color: colors.textSecondary, flex: 1 },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
