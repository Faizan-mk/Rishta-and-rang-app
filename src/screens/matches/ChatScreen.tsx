import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppStackScreenProps } from '../../navigation/types';
import { MessageBubble } from '../../components/matches/MessageBubble';
import { Badge } from '../../components/common/Badge';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useMatches } from '../../store/MatchesContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = AppStackScreenProps<'Chat'>;

export function ChatScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { confirm, notify } = useDialog();
  const { matchId } = route.params;
  const { getMatch, getMessages, sendMessage: sendToMatch, markMatchRead, setMovedToRishta, removeMatch } = useMatches();

  const match = getMatch(matchId);
  const messages = getMessages(matchId);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    markMatchRead(matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (!match) return null;

  const sendMessage = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendToMatch(matchId, trimmed);
    setDraft('');
  };

  const onMoveToRishta = async () => {
    const confirmed = await confirm({
      title: t('chat.moveToRishtaConfirmTitle'),
      message: t('chat.moveToRishtaConfirmBody', { name: match.name }),
      confirmLabel: t('chat.moveToRishta'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    setMovedToRishta(matchId, true);
    sendToMatch(matchId, `💫 ${t('chat.moveToRishtaSent')}`);
  };

  const onBlock = async () => {
    const confirmed = await confirm({
      title: t('chat.blockConfirmTitle', { name: match.name }),
      message: t('chat.blockConfirmBody'),
      confirmLabel: t('chat.block'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) {
      removeMatch(matchId);
      navigation.goBack();
    }
  };

  const onReport = async () => {
    const confirmed = await confirm({
      title: t('chat.reportConfirmTitle', { name: match.name }),
      message: t('chat.reportConfirmBody'),
      confirmLabel: t('chat.report'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) {
      await notify({ title: t('chat.reportSentTitle'), message: t('chat.reportSentBody') });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </Pressable>
        <Image source={{ uri: match.photo }} style={styles.headerAvatar} />
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerName}>{match.name}</Text>
          {match.movedToRishta && <Badge label={t('matches.movedToRishta')} tone="rishta" />}
        </View>
        <Pressable onPress={() => navigation.navigate('Call', { name: match.name, photo: match.photo })} style={styles.headerIconButton}>
          <Ionicons name="call-outline" size={20} color={colors.teal} />
        </Pressable>
        <Pressable onPress={onBlock} style={styles.headerIconButton}>
          <Ionicons name="hand-left-outline" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={onReport} style={styles.headerIconButton}>
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {!match.movedToRishta && (
        <Pressable onPress={onMoveToRishta} style={styles.moveToRishtaBar}>
          <Ionicons name="git-merge" size={16} color={colors.rishta} />
          <Text style={styles.moveToRishtaText}>{t('chat.moveToRishta')}</Text>
        </Pressable>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('matches.typeMessage')}
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, rtl && styles.rtlInput]}
            multiline
          />
          <Pressable onPress={sendMessage} style={styles.sendButton} disabled={!draft.trim()}>
            <Ionicons name="send" size={18} color={colors.textInverse} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backButton: { padding: spacing.xs, marginRight: spacing.xs },
    headerAvatar: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.skeleton },
    headerTextWrap: { flex: 1, marginLeft: spacing.sm, gap: 2 },
    headerName: { ...typography.bodyBold, color: colors.textPrimary },
    headerIconButton: { padding: spacing.xs, marginLeft: spacing.xs },
    moveToRishtaBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.rishtaSoft,
      paddingVertical: spacing.sm,
    },
    moveToRishtaText: { ...typography.label, color: colors.rishta },
    listContent: { padding: spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.sm,
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      maxHeight: 100,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontSize: 15,
    },
    rtlInput: { textAlign: 'right', writingDirection: 'rtl' },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
