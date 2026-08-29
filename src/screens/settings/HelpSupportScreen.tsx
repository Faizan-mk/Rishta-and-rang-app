import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FadeIn } from '../../components/common/FadeInUp';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/Button';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

const FAQ_KEYS = ['selfie', 'subscription', 'reporting', 'changeDetails', 'deleteAccount', 'safety'];

const SUPPORT_EMAIL = 'support@rishtaandrang.app';

export function HelpSupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { notify } = useDialog();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setError(t('help.missingFields'));
      return;
    }
    setError(null);
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSending(false);
    setSubject('');
    setMessage('');
    await notify({ title: t('help.sentTitle'), message: t('help.sentBody') });
  };

  return (
    <ScreenContainer>
      <Text style={[styles.sectionTitle, rtl && styles.rtlText, styles.firstSection]}>{t('help.faqTitle')}</Text>
      <View style={styles.card}>
        {FAQ_KEYS.map((key, index) => {
          const isOpen = expanded === key;
          return (
            <React.Fragment key={key}>
              <Pressable onPress={() => setExpanded(isOpen ? null : key)} style={styles.faqRow}>
                <Text style={[styles.faqQuestion, rtl && styles.rtlText]}>{t(`help.faq.${key}.q`)}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
              </Pressable>
              {isOpen && (
                <FadeIn style={styles.faqAnswerWrap}>
                  <Text style={[styles.faqAnswer, rtl && styles.rtlText]}>{t(`help.faq.${key}.a`)}</Text>
                </FadeIn>
              )}
              {index < FAQ_KEYS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, rtl && styles.rtlText]}>{t('help.contactTitle')}</Text>
      <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={styles.emailRow}>
        <Ionicons name="mail-outline" size={18} color={colors.teal} />
        <Text style={[styles.emailText, rtl && styles.rtlText]}>{t('help.emailUs')}</Text>
      </Pressable>

      <View style={styles.formCard}>
        <TextField label={t('help.subject')} value={subject} onChangeText={setSubject} placeholder={t('help.subjectPlaceholder')} />
        <TextField
          label={t('help.message')}
          value={message}
          onChangeText={setMessage}
          placeholder={t('help.messagePlaceholder')}
          multiline
          numberOfLines={4}
          style={styles.messageInput}
        />
        {error ? <Text style={[styles.errorText, rtl && styles.rtlText]}>{error}</Text> : null}
        <Button label={t('help.send')} onPress={onSend} loading={sending} style={styles.sendButton} />
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    firstSection: { marginTop: 0 },
    sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
    faqQuestion: { ...typography.body, color: colors.textPrimary, flex: 1 },
    faqAnswerWrap: { paddingBottom: spacing.md },
    faqAnswer: { ...typography.caption, color: colors.textSecondary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.tealSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    emailText: { ...typography.label, color: colors.teal },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    messageInput: { minHeight: 90, textAlignVertical: 'top' },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    sendButton: { marginTop: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
