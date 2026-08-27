import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BottomSheet } from '../common/BottomSheet';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { BOOST_DURATION_HOURS, BOOST_MULTIPLIER, useBoost } from '../../store/BoostContext';

interface BoostSheetProps {
  visible: boolean;
  onClose: () => void;
  // "Get more Boosts" — the paywall lives outside this component.
  onGetMore: () => void;
}

function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

// The lightning button in the top bar opens this: a running boost shows its
// countdown, an idle one offers to spend a boost from the member's wallet.
export function BoostSheet({ visible, onClose, onGetMore }: BoostSheetProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { boostsLeft, activeUntil, isBoostActive, startBoost } = useBoost();
  const [now, setNow] = useState(() => Date.now());

  // Only tick while the sheet is open on a running boost — nothing else on the
  // screen needs a per-second re-render.
  useEffect(() => {
    if (!visible || !isBoostActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, isBoostActive]);

  const msLeft = activeUntil ? Math.max(activeUntil.getTime() - now, 0) : 0;
  const totalSeconds = Math.floor(msLeft / 1000);
  const clock = [Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60];

  const title = isBoostActive
    ? t('boost.activeTitle')
    : boostsLeft > 0
      ? t('boost.idleTitle')
      : t('boost.emptyTitle');

  const subtitle = isBoostActive
    ? t('boost.activeSubtitle', { multiplier: BOOST_MULTIPLIER })
    : boostsLeft > 0
      ? t('boost.idleSubtitle', { multiplier: BOOST_MULTIPLIER, hours: BOOST_DURATION_HOURS })
      : t('boost.emptySubtitle');

  return (
    <BottomSheet visible={visible} onClose={onClose} showHandle={false}>
      <View style={styles.body}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, rtl && styles.rtlText]}>{title}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtlText]}>{subtitle}</Text>

          {isBoostActive && (
            <>
              <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('boost.runsOutIn')}</Text>
              <Animated.View entering={FadeIn.duration(200)} style={styles.clockRow}>
                {clock.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <Text style={styles.clockSeparator}>:</Text>}
                    <View style={styles.clockTile}>
                      <Text style={styles.clockText}>{pad(part)}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </Animated.View>
            </>
          )}

          <BoostIllustration colors={colors} />

          <Text style={[styles.walletLine, rtl && styles.rtlText]}>
            {t('boost.boostsLeft', { count: boostsLeft })}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          {!isBoostActive && boostsLeft > 0 && (
            <Pressable onPress={startBoost} style={styles.primaryButton}>
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text style={styles.primaryLabel}>{t('boost.start')}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onGetMore}
            style={[styles.primaryButton, !isBoostActive && boostsLeft > 0 && styles.secondaryButton]}
          >
            <Text style={[styles.primaryLabel, !isBoostActive && boostsLeft > 0 && styles.secondaryLabel]}>
              {t('boost.getMore')}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

// Two profile cards fanned out with a rocket badge between them — drawn in plain
// views so it stays crisp at any size and follows the theme.
function BoostIllustration({ colors }: { colors: Palette }) {
  const styles = useMemo(() => makeIllustrationStyles(colors), [colors]);
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.card, styles.cardLeft]}>
        <Ionicons name="person" size={30} color={colors.rishta} />
      </View>
      <View style={[styles.card, styles.cardRight]}>
        <Ionicons name="person" size={30} color={colors.teal} />
      </View>
      <View style={styles.rocketBadge}>
        <Ionicons name="rocket" size={20} color="#FFFFFF" />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // The panel chrome lives in BottomSheet; this is just its contents.
    body: { paddingBottom: spacing.lg },
    closeButton: { alignSelf: 'flex-start', padding: spacing.md },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
    title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
    clockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
    clockTile: {
      backgroundColor: colors.teal,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minWidth: 68,
      alignItems: 'center',
    },
    clockText: { color: '#FFFFFF', fontSize: scaleFont(26), fontWeight: '800', letterSpacing: 1 },
    clockSeparator: { ...typography.h2, color: colors.textPrimary },
    walletLine: { ...typography.body, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg, fontWeight: '600' },
    footer: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.teal,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      minHeight: 52,
    },
    primaryLabel: { ...typography.h3, color: '#FFFFFF', fontWeight: '700' },
    secondaryButton: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border, minHeight: 48 },
    secondaryLabel: { color: colors.textPrimary },
    rtlText: { writingDirection: 'rtl' },
  });

const makeIllustrationStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { height: 150, width: 190, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
    card: {
      position: 'absolute',
      width: 78,
      height: 104,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardLeft: { left: 10, transform: [{ rotate: '-8deg' }] },
    cardRight: { right: 10, transform: [{ rotate: '8deg' }] },
    rocketBadge: {
      position: 'absolute',
      bottom: 8,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.surface,
    },
  });
