import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { MessageBubble } from '../../components/matches/MessageBubble';
import { Badge } from '../../components/common/Badge';
import { ReportDialog, type ReportSubmission } from '../../components/common/ReportDialog';
import { reportsService } from '../../services/reportsService';
import { FadeIn } from '../../components/common/FadeInUp';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useMatches } from '../../store/MatchesContext';
import { useAuth } from '../../store/AuthContext';
import { rishtaProfileComplete } from '../../utils/rishtaProfile';
import { radius, spacing, typography } from '../../theme';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

export function ChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { confirm, notify } = useDialog();
  const { user } = useAuth();
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const {
    getMatch,
    getMessages,
    sendMessage: sendToMatch,
    sendVoiceMessage,
    sendImageMessage,
    markMatchRead,
    sendRishtaRequest,
    respondRishtaRequest,
    blockMatch,
  } = useMatches();

  const match = getMatch(matchId);
  const messages = getMessages(matchId);
  const [draft, setDraft] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [recording, setRecording] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    markMatchRead(matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (!match) return null;

  // The thread's own world colours the header and the outgoing bubbles' company.
  const accent = modeAccent(colors, match.movedToRishta ? 'rishta' : match.mode);

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

  // What the other person would be asked to consider. Without it there is
  // nothing to decide on, so the request cannot be sent — the database refuses
  // it either way (`rishta_profile_incomplete`), and this is so the bar says so
  // up front and offers the screen that fixes it rather than an error.
  const canRequestRishta = rishtaProfileComplete(user);

  const onMoveToRishta = async () => {
    if (!canRequestRishta) {
      const goToProfile = await confirm({
        title: t('chat.rishtaProfileNeededTitle'),
        message: t('chat.rishtaProfileNeededBody'),
        confirmLabel: t('chat.rishtaProfileNeededAction'),
        cancelLabel: t('common.cancel'),
      });
      if (goToProfile) router.push('/rishta-profile');
      return;
    }

    const confirmed = await confirm({
      title: t('chat.moveToRishtaConfirmTitle'),
      message: t('chat.moveToRishtaConfirmBody', { name: match.name }),
      confirmLabel: t('chat.moveToRishta'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    try {
      await sendRishtaRequest(matchId, t('chat.moveToRishtaSent', { name: match.name }));
    } catch (error) {
      // The gate lives in the database, so its reason arrives as a code rather
      // than a sentence. Only one of them is worth its own wording: the member
      // has not filled in the rishta half of their profile, which is exactly
      // what the other person is being asked to consider.
      const reason = error instanceof Error ? error.message : '';
      await notify(
        reason.includes('rishta_profile_incomplete')
          ? {
              title: t('chat.rishtaProfileNeededTitle'),
              message: t('chat.rishtaProfileNeededBody'),
            }
          : { title: t('chat.moveToRishta'), message: t('chat.rishtaRequestFailed') }
      );
    }
  };

  const onRespondRishta = async (accept: boolean) => {
    try {
      const outcome = await respondRishtaRequest(matchId, accept);
      await notify(
        outcome === 'accepted'
          ? {
              title: t('matches.movedToRishta'),
              message: t('chat.moveToRishtaAccepted', { name: match.name }),
            }
          : { title: t('chat.rishtaDeclinedTitle'), message: t('chat.rishtaDeclinedBody', { name: match.name }) }
      );
    } catch {
      await notify({ title: t('chat.moveToRishta'), message: t('chat.rishtaRequestFailed') });
    }
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
      router.back();
    }
  };

  const onReport = () => setReportVisible(true);

  const onSubmitReport = async (submission: ReportSubmission) => {
    setReportVisible(false);
    // `sourceProfileId` is the other member's account id. A legacy match row
    // without one has nobody to file against, so the report is dropped rather
    // than written against a match id no moderator could resolve.
    if (user && match.sourceProfileId) {
      try {
        await reportsService.submitReport(user.id, {
          targetId: match.sourceProfileId,
          reason: submission.reason,
          details: submission.details,
          context: 'chat',
        });
      } catch {
        await notify({ title: t('report.failedTitle'), message: t('report.failedBody') });
        return;
      }
    }
    await notify({ title: t('chat.reportSentTitle'), message: t('chat.reportSentBody') });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <FadeIn style={[styles.header, rtl && styles.headerRtl]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </Pressable>
        <LinearGradient
          colors={accent.ramp}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.headerAvatarRing}
        >
          <Image source={{ uri: match.photo }} style={styles.headerAvatar} />
        </LinearGradient>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerName} numberOfLines={1}>
            {match.name}
          </Text>
          {/* The stage, not the sentence: this column is what is left after an
              avatar and four icons. Same short label the Matches list uses. */}
          {match.movedToRishta && <Badge label={t('matches.rishtaBadge')} tone="rishta" />}
        </View>
        <Pressable onPress={() => router.push({ pathname: '/call', params: { name: match.name, photo: match.photo } })} style={styles.headerIconButton}>
          <Ionicons name="call-outline" size={20} color={colors.teal} />
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/call', params: { name: match.name, photo: match.photo, video: '1' } })} style={styles.headerIconButton}>
          <Ionicons name="videocam-outline" size={20} color={colors.teal} />
        </Pressable>
        <Pressable onPress={onBlock} style={styles.headerIconButton}>
          <Ionicons name="hand-left-outline" size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={onReport} style={styles.headerIconButton}>
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </FadeIn>

      {!match.movedToRishta && match.rishtaRequestIncoming && (
        <FadeIn delay={80}>
          <View style={styles.rishtaBannerWrap}>
            <LinearGradient
              colors={[colors.rishta, colors.plum]}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={[styles.rishtaBanner, glow(colors.rishta, 0.45, 12, 5)]}
            >
              <Text style={styles.rishtaBannerText}>{t('chat.rishtaIncoming', { name: match.name })}</Text>
              <View style={styles.rishtaBannerActions}>
                <Pressable onPress={() => onRespondRishta(false)} style={styles.rishtaDeclineButton}>
                  <Text style={styles.rishtaDeclineText}>{t('chat.rishtaDecline')}</Text>
                </Pressable>
                <Pressable onPress={() => onRespondRishta(true)} style={styles.rishtaAcceptButton}>
                  <Text style={styles.rishtaAcceptText}>{t('chat.rishtaAccept')}</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </FadeIn>
      )}

      {!match.movedToRishta && !match.rishtaRequestIncoming && (
        <FadeIn delay={80}>
          <Pressable
            onPress={onMoveToRishta}
            disabled={match.rishtaRequestPending}
            // Muted while the request is out, and muted again while the rishta
            // profile is empty — but still tappable in that second case, since
            // the tap is what offers the screen that fills it in.
            style={[
              styles.moveToRishtaWrap,
              (match.rishtaRequestPending || !canRequestRishta) && styles.moveToRishtaBarPending,
            ]}
          >
            <LinearGradient
              colors={[colors.rishta, colors.plum]}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={[styles.moveToRishtaBar, glow(colors.rishta, 0.45, 12, 5)]}
            >
              <Ionicons
                name={
                  match.rishtaRequestPending
                    ? 'time-outline'
                    : canRequestRishta
                      ? 'git-merge'
                      : 'alert-circle-outline'
                }
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.moveToRishtaText}>
                {match.rishtaRequestPending ? t('chat.moveToRishtaPending') : t('chat.moveToRishta')}
              </Text>
            </LinearGradient>
          </Pressable>
        </FadeIn>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Animated.View entering={FadeInUp.duration(220)}>
              <MessageBubble message={item} currentUserId={user?.id} />
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            messages.length > 0 ? <Text style={styles.reactionHint}>{t('reactions.hint')}</Text> : null
          }
        />

        <View style={[styles.inputRow, rtl && styles.inputRowRtl]}>
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
              style={[styles.input, inputFocused && styles.inputFocused, rtl && styles.rtlInput]}
              multiline
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
          )}

          {draft.trim() ? (
            <Pressable onPress={sendMessage}>
              <LinearGradient
                colors={[colors.teal, colors.sage]}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.sendButton, glow(colors.teal, 0.6, 14, 6)]}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPressIn={startRecording} onPressOut={stopRecording}>
              {recording ? (
                <View style={[styles.sendButton, styles.sendButtonRecording, glow(colors.danger, 0.7, 14, 6)]}>
                  <Ionicons name="mic" size={18} color="#FFFFFF" />
                </View>
              ) : (
                <View style={[styles.sendButton, styles.sendButtonIdle]}>
                  <Ionicons name="mic" size={18} color={colors.teal} />
                </View>
              )}
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
      backgroundColor: colors.surfaceElevated,
    },
    // Back button, avatar and the call/report icons all mirror together, so
    // the back chevron stays under the thumb that reaches the reading edge.
    headerRtl: { flexDirection: 'row-reverse' },
    // Symmetric on purpose: the row mirrors wholesale in Urdu, so a directional
    // margin here would end up on the wrong side of the chevron.
    backButton: { padding: spacing.xs, marginHorizontal: spacing.xs },
    headerAvatarRing: { width: 42, height: 42, borderRadius: radius.pill, padding: 2 },
    headerAvatar: { width: '100%', height: '100%', borderRadius: radius.pill, backgroundColor: colors.skeleton },
    // The only column here that can give: everything else in the row is a fixed
    // size, so this is what a long name or a badge has to fit inside.
    headerTextWrap: { flex: 1, minWidth: 0, marginHorizontal: spacing.sm, gap: 2 },
    headerName: { ...typography.bodyBold, color: colors.textPrimary, fontWeight: '800' },
    // Four of these sit in the row, so their margins are what the name and the
    // badge are actually competing against. The tap target stays 40dp-ish via
    // the padding; only the space between them comes down.
    headerIconButton: { padding: spacing.xs, marginHorizontal: 2 },
    rishtaBannerWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    rishtaBanner: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
    rishtaBannerText: { ...typography.label, color: '#FFFFFF', fontWeight: '800' },
    rishtaBannerActions: { flexDirection: 'row', gap: spacing.sm },
    rishtaAcceptButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: '#FFFFFF',
    },
    rishtaAcceptText: { ...typography.label, color: colors.rishta, fontWeight: '800' },
    rishtaDeclineButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: withAlpha('#FFFFFF', 0.6),
    },
    rishtaDeclineText: { ...typography.label, color: '#FFFFFF', fontWeight: '700' },
    moveToRishtaWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    moveToRishtaBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm + 2,
    },
    moveToRishtaBarPending: { opacity: 0.6 },
    moveToRishtaText: { ...typography.label, color: '#FFFFFF', fontWeight: '800' },
    listContent: { padding: spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
    reactionHint: {
      ...typography.caption,
      color: colors.textTertiary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.sm,
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSoft,
      backgroundColor: colors.surfaceElevated,
    },
    inputRowRtl: { flexDirection: 'row-reverse' },
    input: {
      flex: 1,
      maxHeight: 100,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontSize: typography.body.fontSize,
      outlineWidth: 0,
    },
    inputFocused: { borderColor: colors.teal },
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
    recordingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
    recordingText: { ...typography.body, color: colors.danger, fontWeight: '700' },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonIdle: {
      backgroundColor: withAlpha(colors.teal, 0.12),
      borderWidth: 1.5,
      borderColor: withAlpha(colors.teal, 0.35),
    },
    sendButtonRecording: { backgroundColor: colors.danger },
  });
