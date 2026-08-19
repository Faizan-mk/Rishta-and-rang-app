import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TextField } from '../common/TextField';
import { Button } from '../common/Button';
import { spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

const COMPLIMENT_MAX_LENGTH = 200;

interface ProfileActionsFooterProps {
  onSendCompliment: (text: string) => Promise<void>;
}

export function ProfileActionsFooter({ onSendCompliment }: ProfileActionsFooterProps) {
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
      <Button label={t('discover.complimentSend')} onPress={onSubmitCompliment} loading={sending} disabled={!compliment.trim()} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginTop: spacing.lg },
    complimentInput: { minHeight: 70, textAlignVertical: 'top' },
    charCount: { ...typography.caption, color: colors.textTertiary, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
