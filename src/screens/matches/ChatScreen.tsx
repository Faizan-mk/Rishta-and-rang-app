import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import type { AppStackScreenProps } from '../../navigation/types';
import { MessageBubble } from '../../components/matches/MessageBubble';
import { Badge } from '../../components/common/Badge';
import { ReportDialog } from '../../components/common/ReportDialog';
import { FadeIn } from '../../components/common/FadeInUp';
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
  const {
    getMatch,
    getMessages,
    sendMessage: sendToMatch,
    sendVoiceMessage,
    sendImageMessage,
    markMatchRead,
    setMovedToRishta,
    blockMatch,
  } = useMatches();

  const match = getMatch(matchId);
  const messages = getMessages(matchId);
  const [draft, setDraft] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.photoLibraryTitle'), message: t('permissions.photoLibraryBody') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      sendImageMessage(matchId, result.assets[0].uri);
    }
  };

  const startRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.microphoneTitle'), message: t('permissions.microphoneBody') });
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const stopRecording = async () => {
    if (!recording) return;
    const durationSec = recorder.currentTime;
    await recorder.stop();
    setRecording(false);
    if (recorder.uri && durationSec >= 1) {
      sendVoiceMessage(matchId, recorder.uri, durationSec);
    }
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
      blockMatch(matchId);
      navigation.goBack();
    }
  };

  const onReport = () => setReportVisible(true);

  const onSubmitReport = async (_reason: string) => {
    setReportVisible(false);
    await notify({ title: t('chat.reportSentTitle'), message: t('chat.reportSentBody') });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FadeIn style={styles.header}>
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
        <Pressable onPress={() => navigation.navigate('Call', { name: match.name, photo: match.photo, video: true })} style={styles.headerIconButton}>
          <Ionicons name="videocam-outline" size={20} color={colors.teal} />
        </Pressable>
        <Pressable onPress={onBlock} style={styles.headerIconButton}>
          <Ionicons name="hand-left-outline" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={onReport} style={styles.headerIconButton}>
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </FadeIn>

      {!match.movedToRishta && (
        <FadeIn delay={80}>
          <Pressable onPress={onMoveToRishta} style={styles.moveToRishtaBar}>
            <Ionicons name="git-merge" size={16} color={colors.rishta} />
            <Text style={styles.moveToRishtaText}>{t('chat.moveToRishta')}</Text>
          </Pressable>
        </FadeIn>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Animated.View entering={FadeInUp.duration(220)}>
              <MessageBubble message={item} />
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.inputRow}>
          <Pressable onPress={pickImage} style={styles.attachButton} disabled={recording}>
            <Ionicons name="image-outline" size={22} color={recording ? colors.textTertiary : colors.textSecondary} />
          </Pressable>

          {recording ? (
            <View style={styles.recordingRow}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{t('chat.recording')}</Text>
            </View>
          ) : (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('matches.typeMessage')}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, rtl && styles.rtlInput]}
              multiline
            />
          )}

          {draft.trim() ? (
            <Pressable onPress={sendMessage} style={styles.sendButton}>
              <Ionicons name="send" size={18} color={colors.textInverse} />
            </Pressable>
          ) : (
            <Pressable
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={[styles.sendButton, recording && styles.sendButtonRecording]}
            >
              <Ionicons name="mic" size={18} color={colors.textInverse} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <ReportDialog
        visible={reportVisible}
        name={match.name}
        onCancel={() => setReportVisible(false)}
        onSubmit={onSubmitReport}
      />
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
      fontSize: typography.body.fontSize,
    },
    rtlInput: { textAlign: 'right', writingDirection: 'rtl' },
    attachButton: { padding: spacing.xs, marginBottom: 4 },
    recordingRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 40,
      paddingHorizontal: spacing.md,
    },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
    recordingText: { ...typography.body, color: colors.danger },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonRecording: { backgroundColor: colors.danger },
  });
