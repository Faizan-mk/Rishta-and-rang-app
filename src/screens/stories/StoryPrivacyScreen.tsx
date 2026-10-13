import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccentHeading } from '../../components/common/AccentHeading';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { FadeIn } from '../../components/common/FadeInUp';
import { useAuth } from '../../store/AuthContext';
import { useDialog } from '../../store/DialogContext';
import { useLanguage } from '../../store/LanguageContext';
import { useMatches } from '../../store/MatchesContext';
import { useStories } from '../../store/StoriesContext';
import { useTheme } from '../../store/ThemeContext';
import { storiesService, type StoryAudience } from '../../services/storiesService';
import { fonts, radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
import { flat } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const AUDIENCES: { key: StoryAudience; labelKey: string; descKey: string }[] = [
  { key: 'all', labelKey: 'stories.audienceAll', descKey: 'stories.audienceAllDesc' },
  { key: 'dating', labelKey: 'stories.audienceFriends', descKey: 'stories.audienceFriendsDesc' },
  { key: 'rishta', labelKey: 'stories.audienceRishta', descKey: 'stories.audienceRishtaDesc' },
];

// Who sees the member's stories: which of their connections (all, Friends
// only, Rishta only), and anyone they have hidden them from. Enforced by
// supabase/47_story_privacy.sql; every change saves straight away.
export function StoryPrivacyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { user } = useAuth();
  const { notify } = useDialog();
  const { matches, blockedProfiles } = useMatches();
  const { refresh } = useStories();

  const [audience, setAudienceState] = useState<StoryAudience | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    storiesService
      .fetchPrivacy(user.id)
      .then((p) => {
        setAudienceState(p.audience);
        setHidden(new Set(p.hidden));
      })
      .catch(() => setAudienceState('all'));
  }, [user?.id]);

  // One row per connection, the people a story could be hidden from.
  const people = useMemo(() => {
    const blocked = new Set(blockedProfiles.map((b) => b.id));
    return matches
      .filter((m): m is typeof m & { sourceProfileId: string } => Boolean(m.sourceProfileId))
      .filter((m) => !blocked.has(m.sourceProfileId))
      .map((m) => ({ id: m.sourceProfileId, name: m.name, photo: m.photo }));
  }, [matches, blockedProfiles]);

  const failed = () => notify({ title: t('stories.privacySaveFailedTitle'), message: t('stories.privacySaveFailedBody') });

  const chooseAudience = async (next: StoryAudience) => {
    if (!user || next === audience) return;
    const previous = audience;
    setAudienceState(next);
    try {
      await storiesService.setAudience(user.id, next);
      refresh();
    } catch {
      setAudienceState(previous);
      failed();
    }
  };

  const toggleHidden = async (personId: string, hide: boolean) => {
    if (!user) return;
    const apply = (on: boolean) =>
      setHidden((prev) => {
        const nextSet = new Set(prev);
        if (on) nextSet.add(personId);
        else nextSet.delete(personId);
        return nextSet;
      });
    apply(hide);
    try {
      await storiesService.setHidden(user.id, personId, hide);
    } catch {
      apply(!hide);
      failed();
    }
  };

  const ramp = flat(colors.teal);

  return (
    <ScreenContainer edges={['bottom']}>
      <FadeIn>
        <AccentHeading title={t('stories.audienceTitle')} gradient={ramp} style={styles.firstHeading} />
        <View style={styles.card}>
          {audience === null ? (
            <ActivityIndicator color={colors.teal} style={styles.loading} />
          ) : (
            AUDIENCES.map((option, index) => {
              const selected = option.key === audience;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => chooseAudience(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.option, index > 0 && styles.optionDivider, rtl && styles.rowRtl]}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, rtl && styles.rtlText]}>{t(option.labelKey)}</Text>
                    <Text style={[styles.optionDesc, rtl && styles.rtlText]}>{t(option.descKey)}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </FadeIn>

      <FadeIn delay={80}>
        <AccentHeading title={t('stories.hideTitle')} gradient={ramp} style={styles.heading} />
        <Text style={[styles.hint, rtl && styles.rtlText]}>{t('stories.hideHint')}</Text>
        <View style={styles.card}>
          {people.length === 0 ? (
            <Text style={[styles.empty, rtl && styles.rtlText]}>{t('stories.hideEmpty')}</Text>
          ) : (
            people.map((person, index) => (
              <View key={person.id} style={[styles.person, index > 0 && styles.optionDivider, rtl && styles.rowRtl]}>
                <Image source={{ uri: person.photo }} style={styles.avatar} />
                <Text style={[styles.personName, rtl && styles.rtlText]} numberOfLines={1}>
                  {person.name}
                </Text>
                <Switch
                  value={hidden.has(person.id)}
                  onValueChange={(value) => toggleHidden(person.id, value)}
                  trackColor={{ false: colors.border, true: colors.teal }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))
          )}
        </View>
      </FadeIn>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    firstHeading: { marginTop: spacing.sm, marginBottom: spacing.sm },
    heading: { marginTop: spacing.lg, marginBottom: spacing.xs },
    card: { ...cardSurface(colors), borderRadius: radius.lg, paddingHorizontal: spacing.md },
    loading: { marginVertical: spacing.lg },
    option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    rowRtl: { flexDirection: 'row-reverse' },
    optionText: { flex: 1 },
    optionLabel: { ...typography.bodyBold, color: colors.textPrimary },
    optionDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
    hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
    empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
    person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.skeleton },
    personName: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, fontFamily: fonts.bodyBold },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
