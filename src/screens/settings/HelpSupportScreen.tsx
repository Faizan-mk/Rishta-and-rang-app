import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccentHeading } from '../../components/common/AccentHeading';
import { FadeIn } from '../../components/common/FadeInUp';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/Button';
import { useLanguage } from '../../store/LanguageContext';
import { SUPPORT_EMAIL } from '../../constants/Config';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { radius, spacing, typography } from '../../theme';
import { withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const FAQ_KEYS = ['selfie', 'subscription', 'reporting', 'changeDetails', 'deleteAccount', 'safety'];


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
  const safeRamp = [colors.teal, colors.sage] as const;

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
      <AccentHeading title={t('help.faqTitle')} gradient={safeRamp} style={styles.firstSectionHeading} />
      <View style={styles.card}>
        {FAQ_KEYS.map((key, index) => {
          const isOpen = expanded === key;
          return (
            <React.Fragment key={key}>
              <Pressable onPress={() => setExpanded(isOpen ? null : key)} style={styles.faqRow}>
                <Text style={[styles.faqQuestion, isOpen && styles.faqQuestionOpen, rtl && styles.rtlText]}>
                  {t(`help.faq.${key}.q`)}
                </Text>
                <View style={[styles.faqChevron, isOpen && styles.faqChevronOpen]}>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={isOpen ? '#FFFFFF' : colors.textTertiary}
                  />
                </View>
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

      <AccentHeading title={t('help.contactTitle')} gradient={safeRamp} style={styles.sectionHeading} />
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
        <Button
          label={t('help.send')}
          onPress={onSend}
          loading={sending}
          gradient={safeRamp}
          style={styles.sendButton}
        />
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    firstSectionHeading: { marginBottom: spacing.sm },
    sectionHeading: { marginBottom: spacing.sm, marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.md,
    },
    faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
    faqQuestion: { ...typography.body, color: colors.textPrimary, flex: 1, fontWeight: '600' },
    faqQuestionOpen: { color: colors.teal, fontWeight: '800' },
    faqChevron: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      alignItems: 'center',
      justifyContent: 'center',
    },
    faqChevronOpen: { backgroundColor: colors.teal },
    faqAnswerWrap: { paddingBottom: spacing.md },
    faqAnswer: { ...typography.caption, color: colors.textSecondary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: withAlpha(colors.teal, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.teal, 0.32),
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    emailText: { ...typography.label, color: colors.teal, fontWeight: '800' },
    formCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    messageInput: { minHeight: 90, textAlignVertical: 'top' },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    sendButton: { marginTop: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
