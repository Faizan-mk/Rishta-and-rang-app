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
import { fonts, radius, spacing, typography } from '../../theme';
import { cardSurface } from '../../theme/surfaces';
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
  const safeRamp = [colors.teal, colors.dating] as const;

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
              <Pressable onPress={() => setExpanded(isOpen ? null : key)} style={[styles.faqRow, rtl && styles.rowRtl]}>
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
      <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={[styles.emailRow, rtl && styles.rowRtl]}>
        <View style={styles.emailIcon}>
          <Ionicons name="mail-outline" size={18} color={colors.teal} />
        </View>
        <Text style={[styles.emailText, rtl && styles.rtlText]}>{t('help.emailUs')}</Text>
        <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
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
    firstSectionHeading: { marginBottom: spacing.md },
    sectionHeading: { marginBottom: spacing.md, marginTop: spacing.lg },
    card: { ...cardSurface(colors), paddingVertical: 0, paddingBottom: 0, paddingHorizontal: spacing.md },
    rowRtl: { flexDirection: 'row-reverse' },
    faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
    faqQuestion: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
    faqQuestionOpen: { color: colors.teal, fontFamily: fonts.bodyBold },
    faqChevron: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.tealSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    faqChevronOpen: { backgroundColor: colors.teal },
    // The open answer sits on a blush panel with a gold rule on its leading edge.
    faqAnswerWrap: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.tealSoft,
      borderLeftWidth: 3,
      borderLeftColor: colors.gold,
    },
    faqAnswer: { ...typography.body, color: colors.textPrimary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.gold,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingRight: spacing.md,
      marginBottom: spacing.md,
    },
    emailIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.tealSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emailText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
    formCard: { ...cardSurface(colors), marginBottom: spacing.lg, paddingBottom: spacing.lg },
    messageInput: { minHeight: 90, textAlignVertical: 'top' },
    errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
    sendButton: { marginTop: spacing.sm },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
