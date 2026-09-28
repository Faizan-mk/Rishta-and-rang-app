import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  ZoomIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { ChatMessage, MessageReaction } from '../../types/content';
import { REACTION_EMOJIS } from '../../types/content';
import type { Translate } from '../../i18n';
import { fonts, radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { useMatches } from '../../store/MatchesContext';
import { previewFor, previewLabel } from '../../utils/messagePreview';

function formatMessageTime(iso: string, t: Translate): string {
  const date = new Date(iso);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = t(hours >= 12 ? 'chat.timePm' : 'chat.timeAm');
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

// A voice note is never anywhere near an hour long, so anything at or past
// that is not a duration at all — it is old data from before `stopRecording`
// read `getStatus().durationMillis` instead of the platform's `currentTime`
// (which on Android was an epoch timestamp, not an elapsed time). Rather than
// print that garbled number, this reads as "unknown".
const MAX_PLAUSIBLE_DURATION_SEC = 3600;

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0 || totalSeconds >= MAX_PLAUSIBLE_DURATION_SEC) {
    return '0:00';
  }
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** One pill per distinct emoji, with how many people used it and whether I did. */
function groupReactions(reactions: MessageReaction[], userId: string | undefined) {
  const order: string[] = [];
  const counts = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of reactions) {
    const entry = counts.get(reaction.emoji);
    if (entry) {
      entry.count += 1;
      entry.mine = entry.mine || reaction.userId === userId;
    } else {
      order.push(reaction.emoji);
      counts.set(reaction.emoji, { count: 1, mine: reaction.userId === userId });
    }
  }
  return order.map((emoji) => ({ emoji, ...counts.get(emoji)! }));
}

/**
 * How far one of my own messages got, as one glyph.
 *
 * `read` is not stored anywhere: it is the other member's `match_reads` mark
 * against this message's own timestamp (supabase/33_chat_paging_and_receipts.sql),
 * which is absent when they have never opened the thread or have turned their
 * online status off — and an absent mark simply leaves the ticks grey.
 */
function deliveryOf(
  message: ChatMessage,
  theirReadAt?: string
): 'sending' | 'failed' | 'sent' | 'read' | null {
  if (!message.fromMe) return null;
  if (message.status === 'sending') return 'sending';
  if (message.status === 'failed') return 'failed';
  if (theirReadAt && message.sentAt <= theirReadAt) return 'read';
  return 'sent';
}

// How far a swipe has to travel before it counts as "reply", and the most it
// visually drags before rubber-banding stops it — short and light on purpose,
// since this is a hint gesture sitting inside a vertically-scrolling list,
// not a decision gesture like the discovery deck's full-screen swipe.
const REPLY_SWIPE_THRESHOLD = 56;
const REPLY_SWIPE_MAX = 80;

export const MessageBubble = React.memo(function MessageBubble({
  message,
  currentUserId,
  theirReadAt,
  onRetry,
  onDeleteForEveryone,
  onDeleteForMe,
  onSwipeReply,
  replyToMessage,
  counterpartName,
}: {
  message: ChatMessage;
  currentUserId?: string;
  theirReadAt?: string;
  onRetry?: (message: ChatMessage) => void;
  /** Only ever offered on your own messages — the sheet hides it otherwise. */
  onDeleteForEveryone?: (message: ChatMessage) => void;
  onDeleteForMe?: (message: ChatMessage) => void;
  /** Swiping the bubble toward the reading-start edge asks to quote it. */
  onSwipeReply?: (message: ChatMessage) => void;
  /** The message this one quotes, already resolved from the thread in memory. */
  replyToMessage?: ChatMessage;
  /** Only needed to label a quoted message that wasn't mine. */
  counterpartName?: string;
}) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const { getReactions, toggleReaction } = useMatches();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Swiping right replies in a left-to-right thread, left in a right-to-left
  // one — the same mirroring the bubbles themselves already follow.
  const swipeSign = rtl ? -1 : 1;
  const dragX = useSharedValue(0);
  const triggerReply = () => onSwipeReply?.(message);
  // 16dp of horizontal movement before the swipe activates, and no more than
  // 12dp of drift tolerated by the long-press below — a deliberate gap
  // between the two, rather than sharing one boundary, so ordinary finger
  // jitter can never land exactly on the line between them.
  const SWIPE_ACTIVATE_PX = 16;
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Boolean(onSwipeReply))
        .activeOffsetX(swipeSign > 0 ? [SWIPE_ACTIVATE_PX, 999] : [-999, -SWIPE_ACTIVATE_PX])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          const forward = e.translationX * swipeSign;
          dragX.value = Math.max(0, Math.min(forward, REPLY_SWIPE_MAX)) * swipeSign;
        })
        .onEnd((e) => {
          const forward = e.translationX * swipeSign;
          if (forward > REPLY_SWIPE_THRESHOLD) runOnJS(triggerReply)();
          dragX.value = withSpring(0, { damping: 20, stiffness: 260 });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swipeSign, onSwipeReply, message.id]
  );
  // A gesture-handler LongPress here, not a plain RN `Pressable`'s
  // `onLongPress`: the two run on different gesture systems, and nesting a
  // Pressable inside this bubble's GestureDetector let the pan gesture's own
  // touch recognizer win the touch on native before the Pressable's JS-side
  // long-press timer ever got to fire — long-press worked on web (a looser
  // gesture-arena implementation there) and silently never opened on device.
  //
  // `Simultaneous`, not `Race`: Race makes the two compete for the same touch
  // and leaves it to each platform's own gesture arena to referee who wins —
  // which is exactly what was inconsistent phone to phone. Simultaneous lets
  // both recognise independently instead, so nothing has to "win" — a still
  // finger satisfies the long-press's own timer regardless of what the pan
  // gesture is doing, and an actual drag satisfies the pan's own distance
  // threshold regardless of the long-press. `maxDistance` below is what keeps
  // a real drag from also firing the long-press once it is moving.
  const openPicker = () => setPickerOpen(true);
  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(280)
        .maxDistance(12)
        .onStart(() => {
          runOnJS(openPicker)();
        }),
    []
  );
  // The voice note's play/pause and the photo's full-screen open are gestures of
  // *this* composition, not of a `GestureDetector` nested inside it. Nesting
  // does not escape the problem described on `bubbleGesture`: the outer handler
  // still enters the touch arena first and claims the touch, so a child
  // handler — RNGH's or a plain `Pressable`'s — never gets to see it and the
  // tap is silently dead on device. Side by side, all three recognise
  // independently and there is no contest to lose.
  //
  // The child publishes its own handler through `mediaTapRef` rather than the
  // parent reaching into it, so the player and preview state stay where they
  // belong — inside the bubble that owns them.
  const mediaTapRef = useRef<(() => void) | null>(null);
  const isMedia =
    (message.kind === 'voice' && Boolean(message.audioUri)) ||
    (message.kind === 'image' && Boolean(message.imageUri));
  const fireMediaTap = useCallback(() => {
    mediaTapRef.current?.();
  }, []);
  const mediaTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(isMedia)
        .maxDistance(12)
        .onEnd((_event, success) => {
          if (success) runOnJS(fireMediaTap)();
        }),
    [isMedia, fireMediaTap]
  );
  const bubbleGesture = useMemo(
    () => Gesture.Simultaneous(swipeGesture, longPressGesture, mediaTapGesture),
    [swipeGesture, longPressGesture, mediaTapGesture]
  );
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));
  const replyHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value * swipeSign, [0, REPLY_SWIPE_THRESHOLD], [0, 1], 'clamp'),
    transform: [
      { scale: interpolate(dragX.value * swipeSign, [0, REPLY_SWIPE_THRESHOLD], [0.6, 1], 'clamp') },
    ],
  }));

  const reactions = getReactions(message.id);
  const pills = useMemo(() => groupReactions(reactions, currentUserId), [reactions, currentUserId]);

  const textColor = message.fromMe ? styles.textMe : styles.textThem;
  const delivery = deliveryOf(message, theirReadAt);
  const timeLabel = formatMessageTime(message.sentAt, t);

  let content: React.ReactNode;
  if (message.kind === 'voice' && message.audioUri) {
    content = (
      <VoiceBubble
        uri={message.audioUri}
        durationSec={message.durationSec ?? 0}
        fromMe={Boolean(message.fromMe)}
        colors={colors}
        timeLabel={timeLabel}
        tapRef={mediaTapRef}
      />
    );
  } else if (message.kind === 'image' && message.imageUri) {
    content = <ImageBubble uri={message.imageUri} styles={styles} colors={colors} tapRef={mediaTapRef} />;
  } else if (message.text) {
    content = <Text style={[styles.text, textColor, rtl && styles.rtlText]}>{message.text}</Text>;
  } else {
    return null;
  }

  const onPickEmoji = (emoji: string) => {
    setPickerOpen(false);
    toggleReaction(message.id, emoji);
  };

  // Own messages sit on the side the language starts from the far end of, so
  // the thread mirrors as a whole in Urdu rather than half of it.
  const mineSide = rtl ? styles.rowThem : styles.rowMe;
  const theirSide = rtl ? styles.rowMe : styles.rowThem;

  return (
    <View style={[styles.row, message.fromMe ? mineSide : theirSide]}>
      <View style={styles.bubbleWrap}>
        {/* Revealed from underneath as the bubble drags away from it — sits at
            the edge the swipe started from, not the edge it moves toward. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.replyHint, rtl ? styles.replyHintRtl : styles.replyHintLtr, replyHintStyle]}
        >
          <Ionicons name="arrow-undo" size={16} color={colors.teal} />
        </Animated.View>

        <GestureDetector gesture={bubbleGesture} touchAction="pan-y">
          <Animated.View style={swipeStyle}>
            {/* Own messages are a lit gradient, replies a plain surface — the two
                sides of the thread never need re-reading to tell apart. Long-press
                is the GestureDetector above (`longPressGesture`), not this View's
                own touch handling — see the comment on `bubbleGesture`. */}
            <View accessibilityRole="button" accessibilityLabel={t('reactions.a11yReact')}>
              {message.fromMe ? (
                <LinearGradient
                  colors={[colors.teal, colors.dating]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, styles.bubbleMe, glow(colors.teal, 0.35, 10, 4)]}
                >
                  {replyToMessage && (
                    <ReplyQuote message={replyToMessage} fromMe counterpartName={counterpartName} colors={colors} t={t} />
                  )}
                  {content}
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, styles.bubbleThem]}>
                  {replyToMessage && (
                    <ReplyQuote
                      message={replyToMessage}
                      fromMe={false}
                      counterpartName={counterpartName}
                      colors={colors}
                      t={t}
                    />
                  )}
                  {content}
                </View>
              )}
            </View>

        {pills.length > 0 && (
          <View style={[styles.reactionRow, message.fromMe ? styles.reactionRowMe : styles.reactionRowThem]}>
            {pills.map(({ emoji, count, mine }) => (
              <Pressable
                key={emoji}
                onPress={() => toggleReaction(message.id, emoji)}
                accessibilityLabel={t('reactions.a11yPill', { emoji, count })}
              >
                <Animated.View entering={ZoomIn.duration(160)} style={[styles.pill, mine && styles.pillMine]}>
                  <Text style={styles.pillEmoji}>{emoji}</Text>
                  {count > 1 && <Text style={[styles.pillCount, mine && styles.pillCountMine]}>{count}</Text>}
                </Animated.View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.metaRow, message.fromMe ? styles.metaRowMe : styles.metaRowThem]}>
          {/* A voice bubble carries its own time, right beside its duration —
              this row would otherwise say it twice. */}
          {message.kind !== 'voice' && (
            <Text
              style={[styles.timestamp, message.fromMe ? styles.timestampMe : styles.timestampThem]}
              numberOfLines={1}
            >
              {timeLabel}
            </Text>
          )}
          {delivery === 'sending' && (
            <Ionicons name="time-outline" size={12} color={colors.textTertiary} accessibilityLabel={t('chat.statusSending')} />
          )}
          {/* Two ticks either way — the colour is what changes. Grey means the
              message reached the server; blue means their read mark has passed
              it. A different glyph for each would make "delivered" read as a
              lesser thing than it is. */}
          {delivery === 'sent' && (
            <Ionicons
              name="checkmark-done"
              size={14}
              color={colors.textTertiary}
              accessibilityLabel={t('chat.statusSent')}
            />
          )}
          {delivery === 'read' && (
            <Ionicons
              name="checkmark-done"
              size={14}
              color={colors.readReceipt}
              accessibilityLabel={t('chat.statusRead')}
            />
          )}
          {delivery === 'failed' && (
            <Pressable
              onPress={() => onRetry?.(message)}
              style={styles.retry}
              accessibilityRole="button"
              accessibilityLabel={t('netErrors.retry')}
            >
              <Ionicons name="refresh" size={12} color={colors.danger} />
              <Text style={styles.retryLabel}>{t('netErrors.retry')}</Text>
            </Pressable>
          )}
        </View>
          </Animated.View>
        </GestureDetector>
      </View>

      <ReactionPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickEmoji}
        mine={new Set(reactions.filter((r) => r.userId === currentUserId).map((r) => r.emoji))}
        styles={styles}
        t={t}
        onDeleteForEveryone={
          message.fromMe && onDeleteForEveryone
            ? () => {
                setPickerOpen(false);
                onDeleteForEveryone(message);
              }
            : undefined
        }
        onDeleteForMe={
          onDeleteForMe
            ? () => {
                setPickerOpen(false);
                onDeleteForMe(message);
              }
            : undefined
        }
      />
    </View>
  );
});

// Exported for its own tests: opening it depends on a gesture-handler
// long-press, which — like the discovery deck's swipe gesture
// (SwipeableCard.test.tsx) — isn't something Jest's gesture-handler mock
// actually activates, so the sheet's own contents are tested directly here.
export function ReactionPicker({
  visible,
  onClose,
  onPick,
  mine,
  styles,
  t,
  onDeleteForEveryone,
  onDeleteForMe,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  mine: Set<string>;
  styles: ReturnType<typeof makeStyles>;
  t: Translate;
  /** Present only when this is one of my own messages. */
  onDeleteForEveryone?: () => void;
  onDeleteForMe?: () => void;
}) {
  const showDeleteRow = Boolean(onDeleteForEveryone || onDeleteForMe);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose} testID="reaction-picker-backdrop">
        <Animated.View entering={ZoomIn.duration(180)} style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>{t('chat.reactionPickerTitle')}</Text>
          <View style={styles.pickerRow}>
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => onPick(emoji)}
                style={[styles.pickerButton, mine.has(emoji) && styles.pickerButtonMine]}
              >
                <Text style={styles.pickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          {showDeleteRow && (
            <>
              <View style={styles.pickerDivider} />
              <Text style={styles.deleteSheetTitle}>{t('chat.deleteConfirmTitle')}</Text>
              {onDeleteForEveryone && (
                <>
                  <Pressable onPress={onDeleteForEveryone} style={styles.deleteOptionRow} accessibilityRole="button">
                    <Text style={styles.deleteOptionText}>{t('chat.deleteForEveryone')}</Text>
                  </Pressable>
                  <View style={styles.deleteOptionDivider} />
                </>
              )}
              {onDeleteForMe && (
                <>
                  <Pressable onPress={onDeleteForMe} style={styles.deleteOptionRow} accessibilityRole="button">
                    <Text style={styles.deleteOptionText}>{t('chat.deleteForMe')}</Text>
                  </Pressable>
                  <View style={styles.deleteOptionDivider} />
                </>
              )}
            </>
          )}

          <Pressable onPress={onClose} style={styles.deleteOptionRow} accessibilityRole="button">
            <Text style={styles.deleteOptionText}>{t('common.cancel')}</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** The quoted snippet a reply carries at the top of its own bubble — resolved
 * client-side from a message already held in the open thread, never stored
 * as its own copy of that text. */
function ReplyQuote({
  message,
  fromMe,
  counterpartName,
  colors,
  t,
}: {
  message: ChatMessage;
  /** Whether the *replying* bubble (not the quoted message) is my own. */
  fromMe: boolean;
  counterpartName?: string;
  colors: Palette;
  t: Translate;
}) {
  const label = message.fromMe ? t('chat.replyYou') : counterpartName;
  return (
    <View
      style={[
        replyQuoteStyles.wrap,
        {
          borderLeftColor: fromMe ? 'rgba(255,255,255,0.65)' : colors.teal,
          backgroundColor: fromMe ? 'rgba(255,255,255,0.14)' : withAlpha(colors.teal, 0.1),
        },
      ]}
    >
      {label ? (
        <Text numberOfLines={1} style={[replyQuoteStyles.name, { color: fromMe ? '#FFFFFF' : colors.teal }]}>
          {label}
        </Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={[replyQuoteStyles.text, { color: fromMe ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}
      >
        {previewLabel(previewFor(message), t)}
      </Text>
    </View>
  );
}

const replyQuoteStyles = StyleSheet.create({
  wrap: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  name: { ...typography.caption, fontSize: scaleFont(11), fontFamily: fonts.bodyBold },
  text: { ...typography.caption, fontSize: scaleFont(12) },
});

const BAR_COUNT = 18;

// Faint enough to read clearly as "not yet played" against a bubble of either
// colour, close enough that the filled run still looks like one waveform.
const UNPLAYED = 0.3;

// One bar of the waveform. The note's playhead is carried by the bars
// themselves: those it has passed are drawn solid, the rest stay faint, and the
// band right at the playhead is a short gradient rather than a hard switch, so
// the fill reads as moving instead of blinking bar by bar.
function WaveBar({ index, color, progress }: { index: number; color: string; progress: SharedValue<number> }) {
  // Judged by the bar's middle, so it lights up as the playhead reaches it
  // rather than as its leading edge arrives.
  const centre = (index + 0.5) / BAR_COUNT;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [centre - 0.07, centre + 0.07], [UNPLAYED, 1], Extrapolation.CLAMP),
  }));

  return <Animated.View style={[voiceStyles.bar, { backgroundColor: color, height: 6 + ((index * 7) % 14) }, style]} />;
}

function VoiceBubble({
  uri,
  durationSec,
  fromMe,
  colors,
  timeLabel,
  tapRef,
}: {
  uri: string;
  durationSec: number;
  fromMe: boolean;
  colors: Palette;
  timeLabel: string;
  tapRef: React.MutableRefObject<(() => void) | null>;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const { t } = useLanguage();
  // White-on-gradient for an outgoing bubble, the same muted grey as every
  // other caption for an incoming one — matching how the plain-text bubbles
  // already split their own caption colour two paragraphs up.
  const captionColor = fromMe ? 'rgba(255,255,255,0.85)' : colors.textSecondary;

  // How far through the note the playhead is, as a plain 0-1 number. Kept on
  // the UI thread and pushed into a shared value below, because the bars read
  // it from an animated style and should not re-run a worklet per bar on every
  // status tick.
  const total = status.duration || durationSec;
  const ratio = total > 0 ? Math.min(1, Math.max(0, status.currentTime / total)) : 0;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = ratio;
  }, [ratio]);

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.currentTime >= (status.duration ?? durationSec)) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  // Published on every render, deliberately without a dependency list: the
  // parent's tap gesture outlives any single status snapshot, so it has to
  // reach the *current* `togglePlayback` rather than the one that existed when
  // the gesture was first built. A stale closure here would mean a second tap
  // still seeing `playing: false`, and pressing play on an already-playing note
  // would restart it from the top instead of pausing.
  useEffect(() => {
    tapRef.current = togglePlayback;
  });

  useEffect(
    () => () => {
      tapRef.current = null;
    },
    [tapRef]
  );

  const remaining = Math.max((status.duration || durationSec) - status.currentTime, 0);

  // A remote note takes a moment to come down on mobile data, and until it
  // does the bubble used to look exactly like a dead tap. Saying so keeps
  // "still fetching" distinguishable from "broken" — expo-audio 1.1 exposes no
  // error field on the player at all, so claiming a hard failure here would be
  // a guess; a load in progress is the one thing we can actually observe.
  const loading = !status.isLoaded && !status.playing;

  return (
    <View>
      <View
        style={voiceStyles.row}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('chat.voiceNote') : t('chat.playVoiceNote')}
      >
        <Ionicons
          name={status.playing ? 'pause-circle' : 'play-circle'}
          size={30}
          color={fromMe ? '#FFFFFF' : colors.teal}
          style={loading ? { opacity: 0.4 } : undefined}
        />
        <View style={voiceStyles.waveform}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <WaveBar key={i} index={i} color={fromMe ? 'rgba(255,255,255,0.95)' : colors.teal} progress={progress} />
          ))}
        </View>
      </View>
      {/* Duration on the leading edge, right under the waveform it belongs to;
          the time this note was sent trails on the far edge, the way every
          other bubble's caption does. */}
      <View style={voiceStyles.caption}>
        <Text style={[voiceStyles.durationText, { color: captionColor }]}>
          {loading ? t('chat.voiceLoading') : formatDuration(status.playing ? remaining : durationSec)}
        </Text>
        <Text style={[voiceStyles.timeText, { color: captionColor }]}>{timeLabel}</Text>
      </View>
    </View>
  );
}

function ImageBubble({
  uri,
  styles,
  colors,
  tapRef,
}: {
  uri: string;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  tapRef: React.MutableRefObject<(() => void) | null>;
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  // Same reason as the voice note's: the open handler rides on the parent's
  // tap gesture instead of a nested `Pressable` the outer handler would
  // swallow. The fallback tile is covered too — a photo that failed to load is
  // still worth opening, to see whether it is the app or the network at fault.
  useEffect(() => {
    tapRef.current = () => setPreviewVisible(true);
  });

  const closePreview = () => setPreviewVisible(false);

  useEffect(
    () => () => {
      tapRef.current = null;
    },
    [tapRef]
  );

  return (
    <>
      <View accessibilityRole="button" accessibilityLabel={t('chat.openPhoto')}>
        {failed ? (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="image-outline" size={28} color={colors.textTertiary} />
            <Text style={[typography.caption, { color: colors.textTertiary }]}>{t('chat.photoUnavailable')}</Text>
          </View>
        ) : (
          <Image source={{ uri }} style={styles.image} onError={() => setFailed(true)} />
        )}
      </View>
      {/* `statusBarTranslucent` matches every other Modal in the app
          (BottomSheet, ImageCropper, the chat header menu): SDK 54 makes
          edge-to-edge mandatory on Android, so a non-translucent window here
          would force the status bar solid and shove the whole preview down. */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
        statusBarTranslucent
      >
        <Animated.View entering={FadeIn.duration(140)} style={styles.previewFill}>
          <Pressable style={styles.previewOverlay} onPress={closePreview}>
            {/* `contain` over the whole screen, not a band across 80% of it:
               letterboxed as the photo's own shape needs, but with the frame
               reaching both edges of the phone the way a viewer expects. */}
            <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
          </Pressable>
          {/* A visible way out. Tapping the backdrop works, but nothing on the
              screen says so, and on a photo that fills the frame there is no
              backdrop left to find. Deliberately small and low-contrast — it
              should be the quiet way out, not a control competing with the
              picture, and it clears the status bar and the notch rather than
              sitting under them. */}
          <Pressable
            onPress={closePreview}
            hitSlop={8}
            style={[styles.previewClose, { top: insets.top + spacing.xs, right: insets.right + spacing.sm }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

const voiceStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 160 },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  bar: { width: 3, borderRadius: 2 },
  // Play button's icon is 30dp; the caption lines up under the waveform
  // rather than the icon, the way a chat bubble's timestamp always trails
  // the content instead of the avatar.
  caption: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingLeft: 30 + spacing.xs },
  durationText: { ...typography.caption, fontSize: scaleFont(10), fontVariant: ['tabular-nums'] },
  timeText: { ...typography.caption, fontSize: scaleFont(10), fontFamily: fonts.bodySemiBold },
});

export const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginVertical: 4 },
    rowMe: { justifyContent: 'flex-end' },
    rowThem: { justifyContent: 'flex-start' },
    bubbleWrap: { maxWidth: '78%', alignSelf: 'flex-start' },
    // Sits just outside the bubble's own edge, so it reads as revealed from
    // underneath rather than laid over the bubble's content.
    replyHint: {
      position: 'absolute',
      top: '50%',
      marginTop: -14,
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.teal, 0.15),
    },
    replyHintLtr: { left: -34 },
    replyHintRtl: { right: -34 },
    bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    bubbleMe: { borderBottomRightRadius: 5 },
    bubbleThem: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 5,
    },
    text: { ...typography.body },
    textMe: { color: colors.textInverse },
    textThem: { color: colors.textPrimary },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    image: { width: 200, height: 200, borderRadius: radius.md },
    imageFallback: {
      backgroundColor: colors.skeleton,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    previewFill: { flex: 1 },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: '100%', height: '100%' },
    previewClose: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
    },

    // Reactions hang off the bottom edge of the bubble they belong to, on the
    // same side as the bubble, so a long thread still reads as two columns.
    reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
    reactionRowMe: { justifyContent: 'flex-end' },
    reactionRowThem: { justifyContent: 'flex-start' },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    pillMine: { borderColor: withAlpha(colors.teal, 0.55), backgroundColor: withAlpha(colors.teal, 0.14) },
    pillEmoji: { fontSize: scaleFont(13) },
    pillCount: { ...typography.caption, fontSize: scaleFont(11), color: colors.textSecondary, fontFamily: fonts.bodyBold },
    pillCountMine: { color: colors.teal },

    pickerOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    pickerCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.gold, 0.45),
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: spacing.sm,
      minWidth: 240,
    },
    // The emoji row above stays centred; everything below it is a plain
    // action-sheet list — a title and a stack of text options, the same shape
    // as the "Delete message?" dialog this is modelled on, not filled buttons.
    pickerDivider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft },
    deleteSheetTitle: { ...typography.bodyBold, color: colors.textPrimary, fontFamily: fonts.bodyBold },
    deleteOptionRow: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: spacing.sm + 2 },
    deleteOptionDivider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft },
    deleteOptionText: { ...typography.body, color: colors.teal, fontFamily: fonts.bodyBold },
    pickerTitle: { ...typography.caption, color: colors.textSecondary, fontFamily: fonts.bodyBold },
    // Never row-reverse: an emoji row has no reading order to mirror, and the
    // same six always sit in the same places whichever language is on.
    pickerRow: { flexDirection: 'row', gap: spacing.xs },
    pickerButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerButtonMine: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
    pickerEmoji: { fontSize: scaleFont(24) },

    timestamp: { ...typography.caption, fontSize: scaleFont(10), fontFamily: fonts.bodySemiBold },
    timestampMe: { color: colors.textTertiary, textAlign: 'right' },
    timestampThem: { color: colors.textTertiary, textAlign: 'left' },
    // The time and the delivery glyph read as one line, trailing the bubble on
    // whichever side the bubble itself sits.
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    metaRowMe: { justifyContent: 'flex-end' },
    metaRowThem: { justifyContent: 'flex-start' },
    retry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.danger, 0.12),
    },
    retryLabel: { ...typography.caption, fontSize: scaleFont(10), color: colors.danger, fontFamily: fonts.bodyBold },
  });
