import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { MessageBubble } from '../../components/matches/MessageBubble';
import { Badge } from '../../components/common/Badge';
import { ReportDialog, type ReportSubmission } from '../../components/common/ReportDialog';
import { reportsService } from '../../services/reportsService';
import { FadeIn } from '../../components/common/FadeInUp';
import { useFramedContentWidth } from '../../components/common/ResponsiveFrame';
import type { Translate } from '../../i18n';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { useDialog } from '../../store/DialogContext';
import { useMatches } from '../../store/MatchesContext';
import { useNotifications } from '../../store/NotificationContext';
import { useAuth } from '../../store/AuthContext';
import { rishtaProfileComplete } from '../../utils/rishtaProfile';
import { activityLevel, dayLabel, sameDay } from '../../utils/time';
import { discoveryService } from '../../services/discoveryService';
import { supabase } from '../../services/supabase';
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, modeAccent, withAlpha } from '../../theme/glow';
import { ONLINE_GREEN, type Palette } from '../../theme/palettes';
import type { ChatMessage } from '../../types/content';
import { previewFor, previewLabel } from '../../utils/messagePreview';

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

// Well inside the badge's ten-minute window, so someone who arrives while the
// chat is open shows as online rather than a few minutes later.
const ONLINE_POLL_MS = 60 * 1000;
// Tighter than the online-status poll: a stale read receipt sits right next
// to the message it belongs to and is the kind of thing someone actively
// chatting will actually notice within a few seconds, not a few minutes.
const READ_RECEIPT_POLL_MS = 15 * 1000;

export function ChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { confirm, notify } = useDialog();
  const { user } = useAuth();
  const { markReadForMatch } = useNotifications();
  // A Modal (the "⋮" menu below) portals straight to the browser's own body
  // on web, outside ResponsiveFrame's DOM entirely — this is what the menu
  // aligns itself back to the frame's right edge with, instead of drifting
  // out to the real (much wider) browser viewport's.
  const framedWidth = useFramedContentWidth();
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const {
    getMatch,
    getMessages,
    openThread,
    loadOlderMessages,
    getThreadPaging,
    retryMessage,
    sendMessage: sendToMatch,
    sendVoiceMessage,
    sendImageMessage,
    deleteMessage,
    hideMessage,
    clearChat,
    markMatchRead,
    refreshReadReceipt,
    sendRishtaRequest,
    respondRishtaRequest,
    blockMatch,
    blockedProfiles,
    unblockUser,
  } = useMatches();

  const match = getMatch(matchId);
  const messages = getMessages(matchId);
  const thread = getThreadPaging(matchId);
  // The store keeps a thread oldest-first; an inverted list reads newest-first.
  const ordered = useMemo(() => [...messages].reverse(), [messages]);
  // What a reply's own `replyToId` resolves to — the quoted message itself,
  // read back out of the same thread already held in memory rather than a
  // second fetch. Only ever misses on a message older than what is paged in.
  const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const [draft, setDraft] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // What a swipe-to-reply picked, if anything — cleared once whatever is sent
  // next (text, voice or photo) actually goes out quoting it.
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // Where the header's bottom edge actually is on screen. On web this is
  // measured fresh each time the menu opens: the Modal it renders in portals
  // to the browser's own document body (outside both the SafeAreaView and
  // ResponsiveFrame), so its coordinate origin is the real browser window's
  // top-left, not the frame's — and the frame can itself sit offset within
  // that window (it is vertically centred whenever the window is taller than
  // the frame's own max height). `measureInWindow` reports a position already
  // relative to that same real window, so it lines up correctly regardless of
  // that offset.
  // On native this is `insets.top + headerHeight` instead of a
  // `measureInWindow` reading against the *activity* window — that reading's
  // meaning shifts under Android's edge-to-edge handling (mandatory since
  // SDK 54, but which of two builds on the same device has actually picked it
  // up varies with how recently each was rebuilt), so the same code measured
  // fine on one build and landed the menu under the status bar on another.
  // `insets.top` plus the header's own intrinsic layout height never depends
  // on that: it lines up with the Modal's edge-to-edge window regardless of
  // whether the activity underneath happens to be edge-to-edge itself.
  const [menuTop, setMenuTop] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [recording, setRecording] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // The other member's last-seen time and live presence, kept current while
  // this screen is open. The match row carries a seed `lastActiveAt` from the
  // last matches fetch, which on a chat left open for a while is exactly as
  // old as the screen — and "online" is the one badge that has to be true
  // *now* or not shown at all. `supabase/43_online_presence.sql` puts
  // `profiles` on the realtime publication for exactly this: the moment the
  // other side's `is_online` flips (their app leaves the foreground), this
  // screen hears it directly rather than waiting for its own next poll tick
  // or for the member to leave and reopen the chat. The poll stays as a
  // resilience backstop for a channel that never connects or drops silently
  // (same reasoning as the read-receipt poll below).
  const counterpartId = match?.sourceProfileId;
  const [seenAt, setSeenAt] = useState<string | undefined>(match?.lastActiveAt);
  const [counterpartOnline, setCounterpartOnline] = useState(false);

  useEffect(() => {
    if (!counterpartId) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const activity = await discoveryService.fetchActivity([counterpartId]);
        const entry = activity.get(counterpartId);
        if (!cancelled && entry) {
          setSeenAt(entry.lastActiveAt ?? undefined);
          setCounterpartOnline(entry.isOnline);
        }
      } catch {
        // Keep whatever is on screen; a stale dot only ever understates.
      }
    };

    void refresh();
    const timer = setInterval(refresh, ONLINE_POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const channel = supabase
      .channel(`profile_presence_${counterpartId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${counterpartId}` },
        (payload) => {
          const row = payload.new as { last_active_at: string | null; is_online: boolean | null };
          if (cancelled) return;
          setSeenAt(row.last_active_at ?? undefined);
          setCounterpartOnline(Boolean(row.is_online));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [counterpartId]);

  // The blue tick otherwise only ever moves forward when the realtime
  // `match_reads` listener actually delivers — this is what catches it back
  // up if that one event was ever missed, for a screen someone is watching.
  useEffect(() => {
    void refreshReadReceipt(matchId);
    const timer = setInterval(() => void refreshReadReceipt(matchId), READ_RECEIPT_POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshReadReceipt(matchId);
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    markMatchRead(matchId);
    // The Notifications tab's own "X sent you a message" row for this thread
    // is exactly as stale as the Matches list's unread badge would have been
    // without this — read here, it should not still say unread there.
    markReadForMatch(matchId);
    // The thread is paged in, so opening it is what fetches the newest page.
    // Until then the list holds only the preview the matches list was built
    // from — one line, which is better than an empty screen.
    openThread(matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // A message that arrives while this screen is already open is read the
  // instant it lands — re-marking on every new one is what keeps the Matches
  // list's unread badge from coming back for a thread the member is actively
  // looking at right now. Without this it only cleared on the *next* visit,
  // since the effect above only fires once per mount.
  useEffect(() => {
    markMatchRead(matchId);
    markReadForMatch(matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  if (!match) return null;

  // The block stands until this member lifts it themselves — checked against
  // the counterpart's id rather than kept on the match, since it is
  // `blocked_users` that `messages_insert` actually gates
  // (supabase/22_block_hardening.sql, supabase/35_block_keeps_thread.sql).
  const isBlocked = Boolean(match.sourceProfileId) && blockedProfiles.some((b) => b.id === match.sourceProfileId);

  // The thread's own world colours the header and the outgoing bubbles' company.
  const accent = modeAccent(colors, match.movedToRishta ? 'rishta' : match.mode);
  // Same rule as the deck's pill, so "online" means one thing across the app —
  // and a member who has hidden their online status has no timestamp at all,
  // which lands here as simply not online.
  const online = activityLevel(seenAt, counterpartOnline) === 'online';

  const sendMessage = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendToMatch(matchId, trimmed, replyTo?.id);
    setDraft('');
    setReplyTo(null);
  };

  // The sheet's own three options — Delete for everyone / Delete for me /
  // Cancel — are the confirmation: picking one of the first two is a deliberate
  // choice already, not a first step that needs a second dialog asking again.
  const onDeleteForEveryone = (message: ChatMessage) => deleteMessage(matchId, message);
  const onDeleteForMe = (message: ChatMessage) => hideMessage(matchId, message);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await notify({ title: t('permissions.photoLibraryTitle'), message: t('permissions.photoLibraryBody') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      sendImageMessage(matchId, result.assets[0].uri, replyTo?.id);
      setReplyTo(null);
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
    // Not `recorder.currentTime` — on Android that property is the recording's
    // *start* epoch in milliseconds (expo-audio's AudioModule.kt returns
    // `recorder.startTime`, not elapsed time), which is where the multi-billion
    // "duration" garbling the voice bubble's text came from. `getStatus()` is
    // the one place expo-audio documents an actual elapsed duration.
    const durationSec = recorder.getStatus().durationMillis / 1000;
    await recorder.stop();
    setRecording(false);
    if (recorder.uri && durationSec >= 1) {
      sendVoiceMessage(matchId, recorder.uri, durationSec, replyTo?.id);
      setReplyTo(null);
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
    // Stays on the thread rather than leaving it, now that a block no longer
    // deletes it — the blocked banner below is what shows the result.
    if (confirmed) blockMatch(matchId);
  };

  const onUnblock = () => {
    if (match.sourceProfileId) unblockUser(match.sourceProfileId);
  };

  // Wipes this side of the thread only — the other participant keeps every
  // one of their own messages, and can still write into it afterwards.
  const onClearChat = async () => {
    const confirmed = await confirm({
      title: t('chat.clearChatConfirmTitle'),
      message: t('chat.clearChatConfirmBody', { name: match.name }),
      confirmLabel: t('chat.clearChat'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) clearChat(matchId);
  };

  const onReport = () => setReportVisible(true);

  const openMenu = () => {
    if (Platform.OS === 'web') {
      headerRef.current?.measureInWindow((_x, y, _width, height) => setMenuTop(y + height));
    } else {
      setMenuTop(insets.top + headerHeight);
    }
    setMenuOpen(true);
  };

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
      <FadeIn
        ref={headerRef}
        style={[styles.header, rtl && styles.headerRtl]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
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
          <View style={[styles.headerMetaRow, rtl && styles.headerMetaRowRtl]}>
            {/* Only "now". Anything older is not something to say under
                someone's name in a conversation — the deck's card is where
                "active this week" belongs. */}
            {online && (
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{t('chat.online')}</Text>
              </View>
            )}
            {/* The stage, not the sentence: this column is what is left after an
                avatar and four icons. Same short label the Matches list uses. */}
            {match.movedToRishta && <Badge label={t('matches.rishtaBadge')} tone="rishta" />}
          </View>
        </View>
        <Pressable
          onPress={openMenu}
          style={styles.headerIconButton}
          accessibilityLabel={t('chat.moreOptions')}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </Pressable>
      </FadeIn>

      <HeaderMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onVoiceCall={() => router.push({ pathname: '/call', params: { name: match.name, photo: match.photo } })}
        onVideoCall={() =>
          router.push({ pathname: '/call', params: { name: match.name, photo: match.photo, video: '1' } })
        }
        onBlock={isBlocked ? undefined : onBlock}
        onReport={onReport}
        onClearChat={onClearChat}
        topOffset={menuTop}
        framedWidth={framedWidth}
        colors={colors}
        styles={styles}
        t={t}
      />

      {!isBlocked && !match.movedToRishta && match.rishtaRequestIncoming && (
        <FadeIn delay={80}>
          <View style={styles.rishtaBannerWrap}>
            <LinearGradient
              colors={[colors.rishta, colors.plum]}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={[styles.rishtaBanner, glow(colors.rishta, 0.3, 14, 5)]}
            >
              <Ionicons name="moon" size={18} color={RISHTA_GOLD} />
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

      {!isBlocked && !match.movedToRishta && !match.rishtaRequestIncoming && (
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

      {/* Android's edge-to-edge display (on by default since SDK 54) stopped the
          window from resizing itself for the keyboard, so `undefined` here left
          the composer with nothing pushing it up above the keyboard — 'height'
          is what shrinks this view's own height by the keyboard's, moving the
          input row (its sibling inside here) back into view. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Inverted, which is what makes paging possible at all: the newest
            message is index 0 and sits at the bottom, so "load older" is the
            list's own end and the scroll position does not jump when a page
            lands above what is being read. */}
        <FlatList
          data={ordered}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            // The list is newest-first, so the message *after* this one is the
            // older one. A divider belongs above this message whenever the two
            // fall on different days — and above the oldest message always,
            // which is what the `index + 1` miss means.
            const older = ordered[index + 1];
            const startsDay = !older || !sameDay(item.sentAt, older.sentAt);
            return (
              <Animated.View entering={FadeInUp.duration(220)}>
                {/* An inverted list flips each cell back the right way up, so
                    this renders above the bubble exactly as it reads here. */}
                {startsDay && (
                  <View style={styles.dayDivider}>
                    <Text style={styles.dayLabel}>{dayLabel(item.sentAt, t)}</Text>
                  </View>
                )}
                <MessageBubble
                  message={item}
                  currentUserId={user?.id}
                  theirReadAt={match.theirReadAt}
                  onRetry={retryMessage}
                  onDeleteForEveryone={onDeleteForEveryone}
                  onDeleteForMe={onDeleteForMe}
                  onSwipeReply={setReplyTo}
                  replyToMessage={item.replyToId ? messageById.get(item.replyToId) : undefined}
                  counterpartName={match.name}
                />
              </Animated.View>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => loadOlderMessages(matchId)}
          onEndReachedThreshold={0.4}
          // Inverted, so the "footer" renders at the top — where older messages
          // are being fetched from.
          ListFooterComponent={
            thread.loading ? (
              // Inverted, so this sits at the visual top — where a member who
              // has scrolled up is waiting to see that something is happening.
              <View style={styles.loadingOlder}>
                <ActivityIndicator size="small" color={colors.teal} />
                <Text style={styles.loadingOlderLabel}>{t('chat.loadingOlder')}</Text>
              </View>
            ) : messages.length > 0 && !thread.hasMore ? (
              <Text style={styles.reactionHint}>{t('reactions.hint')}</Text>
            ) : null
          }
        />

        {isBlocked ? (
          <View style={[styles.blockedBar, rtl && styles.inputRowRtl]}>
            <Text style={[styles.blockedText, rtl && styles.rtlText]}>
              {t('chat.blockedBannerBody', { name: match.name })}
            </Text>
            <Pressable onPress={onUnblock} style={styles.unblockButton}>
              <Text style={styles.unblockButtonText}>{t('privacy.unblock')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {replyTo && (
              <View style={[styles.replyBar, rtl && styles.inputRowRtl]}>
                <View style={styles.replyBarAccent} />
                <View style={styles.replyBarText}>
                  <Text style={styles.replyBarLabel} numberOfLines={1}>
                    {t('chat.replyingTo', { name: replyTo.fromMe ? t('chat.replyYou') : match.name })}
                  </Text>
                  <Text style={styles.replyBarPreview} numberOfLines={1}>
                    {previewLabel(previewFor(replyTo), t)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setReplyTo(null)}
                  style={styles.replyBarClose}
                  accessibilityLabel={t('common.cancel')}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}
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
                  colors={[colors.teal, colors.dating]}
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
          </>
        )}
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

/**
 * The header's "⋮" overflow menu — a proper anchored dropdown under the
 * button that opened it, each row a leading icon plus its label like any
 * native menu, rather than five separate icon buttons competing with the
 * name and badge for space. Tapping the backdrop dismisses it, so there is
 * no separate Cancel row to tap past.
 */
function HeaderMenu({
  visible,
  onClose,
  onVoiceCall,
  onVideoCall,
  onBlock,
  onReport,
  onClearChat,
  topOffset,
  framedWidth,
  colors,
  styles,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  /** Absent once already blocked — the blocked banner is where unblocking lives. */
  onBlock?: () => void;
  onReport: () => void;
  onClearChat: () => void;
  /** The header's measured on-screen bottom edge — where the menu clears it. */
  topOffset: number;
  /** Caps the menu's row to the app frame's width on web; unset elsewhere. */
  framedWidth?: number;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: Translate;
}) {
  const run = (action: () => void) => {
    onClose();
    action();
  };

  return (
    // `statusBarTranslucent` must be true, matching the rest of the app's
    // Modals (BottomSheet, ImageCropper): SDK 54 makes edge-to-edge mandatory
    // on Android, so the activity's window already draws under the status
    // bar. `topOffset` is a `measureInWindow` value taken in that same
    // edge-to-edge coordinate space. Leaving this Modal's own window
    // non-translucent forces the status bar solid for as long as the menu is
    // open, which shifts the *whole* screen down by the status bar's height —
    // but `topOffset` was captured before that shift, so the menu renders
    // that same distance too high relative to the "⋮" that opened it, right
    // under the status bar, in a production build (where the activity is
    // truly edge-to-edge) even though it looked fine in Expo Go/an older dev
    // client that predated the mandatory edge-to-edge switch.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={[styles.menuOverlay, { paddingTop: topOffset }]}
        onPress={onClose}
        testID="chat-header-menu-backdrop"
      >
        {/* On web the Modal itself spans the real browser viewport, not the
            phone-width frame — this caps the row it anchors to back down to
            the frame's own width, so "flex-end" lands on the frame's right
            edge instead of the browser window's. */}
        <View style={[styles.menuFrameBounds, framedWidth ? { maxWidth: framedWidth } : null]}>
          <Animated.View entering={ZoomIn.duration(140)} style={styles.menuCard}>
          <Pressable onPress={() => run(onVoiceCall)} style={styles.menuOptionRow}>
            <Ionicons name="call-outline" size={16} color={colors.teal} style={styles.menuOptionIcon} />
            <Text style={styles.menuOptionText} numberOfLines={1}>
              {t('chat.voiceCall')}
            </Text>
          </Pressable>
          <Pressable onPress={() => run(onVideoCall)} style={styles.menuOptionRow}>
            <Ionicons name="videocam-outline" size={16} color={colors.teal} style={styles.menuOptionIcon} />
            <Text style={styles.menuOptionText} numberOfLines={1}>
              {t('chat.videoCall')}
            </Text>
          </Pressable>
          <View style={styles.menuDivider} />
          {onBlock && (
            <Pressable onPress={() => run(onBlock)} style={styles.menuOptionRow}>
              <Ionicons name="hand-left-outline" size={16} color={colors.textSecondary} style={styles.menuOptionIcon} />
              <Text style={[styles.menuOptionText, { color: colors.textPrimary }]} numberOfLines={1}>
                {t('chat.block')}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => run(onReport)} style={styles.menuOptionRow}>
            <Ionicons name="flag-outline" size={16} color={colors.textSecondary} style={styles.menuOptionIcon} />
            <Text style={[styles.menuOptionText, { color: colors.textPrimary }]} numberOfLines={1}>
              {t('chat.report')}
            </Text>
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable onPress={() => run(onClearChat)} style={styles.menuOptionRow}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} style={styles.menuOptionIcon} />
            <Text style={[styles.menuOptionText, { color: colors.danger }]} numberOfLines={1}>
              {t('chat.clearChat')}
            </Text>
          </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

// Pale champagne that reads on the rosewood Rishta cards in both themes.
const RISHTA_GOLD = '#F3D99B';

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
      backgroundColor: colors.surfaceElevated,
    },
    // Back button, avatar and the call/report icons all mirror together, so
    // the back chevron stays under the thumb that reaches the reading edge.
    headerRtl: { flexDirection: 'row-reverse' },
    // Symmetric on purpose: the row mirrors wholesale in Urdu, so a directional
    // margin here would end up on the wrong side of the chevron.
    backButton: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: spacing.sm,
    },
    headerAvatarRing: { width: 44, height: 44, borderRadius: radius.pill, padding: 2 },
    headerAvatar: { width: '100%', height: '100%', borderRadius: radius.pill, backgroundColor: colors.skeleton },
    // The only column here that can give: everything else in the row is a fixed
    // size, so this is what a long name or a badge has to fit inside.
    headerTextWrap: { flex: 1, minWidth: 0, marginHorizontal: spacing.sm, gap: 2 },
    headerName: { ...typography.h3, color: colors.textPrimary },
    headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    headerMetaRowRtl: { flexDirection: 'row-reverse' },
    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ONLINE_GREEN },
    onlineText: { ...typography.caption, color: ONLINE_GREEN, fontFamily: fonts.bodyBold },
    // Four of these sit in the row, so their margins are what the name and the
    // badge are actually competing against. The tap target stays 40dp-ish via
    // the padding; only the space between them comes down.
    headerIconButton: { padding: spacing.xs, marginHorizontal: 2 },
    // Anchored top-right, under the "⋮" that opened it — a dropdown, not a
    // centred sheet, so it reads as coming from that one button.
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.25)',
      // Centred, matching ResponsiveFrame's own backdrop — `menuFrameBounds`
      // below is what actually pins the menu to a right edge, capped to the
      // frame's width so that edge is the frame's, not the raw viewport's.
      alignItems: 'center',
      // paddingTop is set per-render from `menuTop`, the header's freshly
      // measured on-screen bottom edge (see `openMenu`) — a fixed value here
      // would clear the header on one device/browser and cut through it on
      // another.
    },
    menuFrameBounds: { width: '100%', alignItems: 'flex-end', paddingRight: spacing.sm },
    // A fixed width rather than a `minWidth` — the app's display font runs
    // wide, and letting the card shrink-wrap its widest row let it stretch
    // most of the way across the screen instead of reading as a small menu.
    menuCard: {
      width: 180,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.xs,
      shadowColor: '#2A1720',
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    menuOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
    },
    menuOptionIcon: { width: 16 },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft, marginVertical: spacing.xs },
    menuOptionText: { fontSize: scaleFont(13.5), fontFamily: fonts.bodySemiBold, color: colors.textPrimary },
    rishtaBannerWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    // Rosewood card with a gold hairline: the signature Rishta moment.
    rishtaBanner: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(RISHTA_GOLD, 0.6),
      padding: spacing.md,
      gap: spacing.sm,
    },
    rishtaBannerText: { ...typography.h3, color: '#FFFFFF' },
    rishtaBannerActions: { flexDirection: 'row', gap: spacing.sm },
    rishtaAcceptButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.pill,
      backgroundColor: '#FFFFFF',
    },
    rishtaAcceptText: { ...typography.label, color: colors.rishta, fontFamily: fonts.bodyBold },
    rishtaDeclineButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: withAlpha(RISHTA_GOLD, 0.8),
    },
    rishtaDeclineText: { ...typography.label, color: '#FFFFFF', fontFamily: fonts.bodyBold },
    moveToRishtaWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    moveToRishtaBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(RISHTA_GOLD, 0.6),
      paddingVertical: spacing.sm + 2,
    },
    moveToRishtaBarPending: { opacity: 0.6 },
    moveToRishtaText: { ...typography.label, color: '#FFFFFF', fontFamily: fonts.bodyBold },
    // An inverted list grows from the bottom on its own, so `justifyContent`
    // is not needed here any more — and would push a short thread the wrong way.
    listContent: { padding: spacing.md, flexGrow: 1 },
    loadingOlder: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
    },
    loadingOlderLabel: { ...typography.caption, color: colors.textTertiary, fontFamily: fonts.bodySemiBold },
    // A quiet marker, not a heading: it separates days without competing with
    // the messages on either side of it.
    dayDivider: {
      alignSelf: 'center',
      marginVertical: spacing.sm,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dayLabel: { ...typography.caption, color: colors.textSecondary, fontFamily: fonts.bodyBold },
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
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    inputRowRtl: { flexDirection: 'row-reverse' },
    // Sits directly on top of the input row it belongs to, no border between
    // them, so the two read as one composer rather than a banner plus a bar.
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      backgroundColor: colors.surfaceElevated,
    },
    replyBarAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.gold },
    replyBarText: { flex: 1, minWidth: 0 },
    replyBarLabel: { ...typography.caption, fontSize: scaleFont(11), color: colors.teal, fontFamily: fonts.bodyBold },
    replyBarPreview: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
    replyBarClose: { padding: spacing.xs },
    blockedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    blockedText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
    unblockButton: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.gold,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    unblockButtonText: { ...typography.label, color: colors.teal, fontFamily: fonts.bodyBold },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    input: {
      flex: 1,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontSize: typography.body.fontSize,
      fontFamily: typography.body.fontFamily,
      outlineWidth: 0,
    },
    inputFocused: { borderColor: colors.gold, backgroundColor: colors.surface },
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
    recordingText: { ...typography.body, color: colors.danger, fontFamily: fonts.bodyBold },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonIdle: {
      backgroundColor: colors.tealSoft,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.6),
    },
    sendButtonRecording: { backgroundColor: colors.danger },
  });
