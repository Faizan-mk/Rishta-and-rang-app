import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../common/TextField';
import { Button } from '../common/Button';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

const COMPLIMENT_MAX_LENGTH = 200;

interface ProfileActionsFooterProps {
  name: string;
  liked: boolean;
  onSendCompliment: (text: string) => Promise<void>;
  onShare: () => void;
  onToggleFavourite: () => void;
  onBlock: () => void;
  onReport: () => void;
}

export function ProfileActionsFooter({
  name,
  liked,
  onSendCompliment,
  onShare,
  onToggleFavourite,
  onBlock,
  onReport,
}: ProfileActionsFooterProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [compliment, setCompliment] = useState('');
  const [sending, setSending] = useState(false);

  const onSubmitCompliment = async () => {
    const trimmed = compliment.trim();
    if (!trimmed || sending) return;
    setSending(true);
    await onSendCompliment(trimmed);
    setSending(false);
    setCompliment('');
  };

  return (
    <View>
      <View style={styles.section}>
        <TextField
          label={t('discover.complimentTitle')}
          value={compliment}
          onChangeText={setCompliment}
          placeholder={t('discover.complimentPlaceholder')}
          multiline
          numberOfLines={3}
          maxLength={COMPLIMENT_MAX_LENGTH}
          style={styles.complimentInput}
        />
        <Text style={[styles.charCount, rtl && styles.rtlText]}>{compliment.length}/{COMPLIMENT_MAX_LENGTH}</Text>
        <Button
          label={t('discover.complimentSend')}
          onPress={onSubmitCompliment}
          loading={sending}
          disabled={!compliment.trim()}
        />
      </View>

      <View style={styles.utilityRow}>
        <UtilityAction icon="share-outline" label={t('discover.share')} onPress={onShare} colors={colors} />
        <UtilityAction
          icon={liked ? 'star' : 'star-outline'}
          label={liked ? t('discover.favourited') : t('discover.favourite')}
          onPress={onToggleFavourite}
          colors={colors}
          active={liked}
        />
        <UtilityAction icon="hand-left-outline" label={t('discover.block')} onPress={onBlock} colors={colors} />
        <UtilityAction icon="flag-outline" label={t('discover.report')} onPress={onReport} colors={colors} />
      </View>
    </View>
  );
}

function UtilityAction({
  icon,
  label,
  onPress,
  colors,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: Palette;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={utilityStyles.button}>
      <Ionicons name={icon} size={20} color={active ? colors.gold : colors.textSecondary} />
      <Text style={[utilityStyles.label, { color: active ? colors.gold : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const utilityStyles = StyleSheet.create({
  button: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.sm },
  label: { ...typography.caption, fontWeight: '600' },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginTop: spacing.lg },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
    complimentInput: { minHeight: 70, textAlignVertical: 'top' },
    charCount: { ...typography.caption, color: colors.textTertiary, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.sm },
    utilityRow: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
