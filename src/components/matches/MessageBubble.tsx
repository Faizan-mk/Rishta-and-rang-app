import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { ChatMessage, MessageReaction } from '../../types/content';
import { REACTION_EMOJIS } from '../../types/content';
import type { Translate } from '../../i18n';
import { radius, spacing, typography } from '../../theme';
import { scaleFont } from '../../theme/responsive';
import { glow, withAlpha } from '../../theme/glow';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { useMatches } from '../../store/MatchesContext';

function formatMessageTime(iso: string, t: Translate): string {
  const date = new Date(iso);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = t(hours >= 12 ? 'chat.timePm' : 'chat.timeAm');
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDuration(totalSeconds: number): string {
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

export const MessageBubble = React.memo(function MessageBubble({
  message,
  currentUserId,
}: {
  message: ChatMessage;
  currentUserId?: string;
}) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const { getReactions, toggleReaction } = useMatches();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reactions = getReactions(message.id);
  const pills = useMemo(() => groupReactions(reactions, currentUserId), [reactions, currentUserId]);

  const textColor = message.fromMe ? styles.textMe : styles.textThem;

  let content: React.ReactNode;
  if (message.kind === 'voice' && message.audioUri) {
    content = <VoiceBubble uri={message.audioUri} durationSec={message.durationSec ?? 0} fromMe={Boolean(message.fromMe)} colors={colors} />;
  } else if (message.kind === 'image' && message.imageUri) {
    content = <ImageBubble uri={message.imageUri} styles={styles} colors={colors} />;
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
        {/* Own messages are a lit gradient, replies a plain surface — the two
            sides of the thread never need re-reading to tell apart. */}
        <Pressable
          onLongPress={() => setPickerOpen(true)}
          delayLongPress={280}
          accessibilityLabel={t('reactions.a11yReact')}
        >
          {message.fromMe ? (
            <LinearGradient
              colors={[colors.teal, colors.sage]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.bubble, styles.bubbleMe, glow(colors.teal, 0.35, 10, 4)]}
            >
              {content}
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.bubbleThem]}>{content}</View>
          )}
        </Pressable>

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

        <Text style={[styles.timestamp, message.fromMe ? styles.timestampMe : styles.timestampThem]}>
          {formatMessageTime(message.sentAt, t)}
        </Text>
      </View>

      <ReactionPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickEmoji}
        mine={new Set(reactions.filter((r) => r.userId === currentUserId).map((r) => r.emoji))}
        styles={styles}
        t={t}
      />
    </View>
  );
});

function ReactionPicker({
  visible,
  onClose,
  onPick,
  mine,
  styles,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  mine: Set<string>;
  styles: ReturnType<typeof makeStyles>;
  t: Translate;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
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
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function VoiceBubble({ uri, durationSec, fromMe, colors }: { uri: string; durationSec: number; fromMe: boolean; colors: Palette }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

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

  const remaining = Math.max((status.duration || durationSec) - status.currentTime, 0);

  return (
    <Pressable onPress={togglePlayback} style={voiceStyles.row}>
      <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={30} color={fromMe ? '#FFFFFF' : colors.teal} />
      <View style={voiceStyles.waveform}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View
            key={i}
            style={[
              voiceStyles.bar,
              { height: 6 + ((i * 7) % 14), backgroundColor: fromMe ? 'rgba(255,255,255,0.7)' : colors.teal },
            ]}
          />
        ))}
      </View>
      <Text style={[voiceStyles.duration, { color: fromMe ? '#FFFFFF' : colors.textSecondary }]}>
        {formatDuration(status.playing ? remaining : durationSec)}
      </Text>
    </Pressable>
  );
}

function ImageBubble({ uri, styles, colors }: { uri: string; styles: ReturnType<typeof makeStyles>; colors: Palette }) {
  const { t } = useLanguage();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={[styles.image, styles.imageFallback]}>
        <Ionicons name="image-outline" size={28} color={colors.textTertiary} />
        <Text style={[typography.caption, { color: colors.textTertiary }]}>{t('chat.photoUnavailable')}</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setPreviewVisible(true)}>
        <Image source={{ uri }} style={styles.image} onError={() => setFailed(true)} />
      </Pressable>
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Animated.View entering={FadeIn.duration(140)} style={styles.previewFill}>
          <Pressable style={styles.previewOverlay} onPress={() => setPreviewVisible(false)}>
            <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
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
  duration: { ...typography.caption, fontVariant: ['tabular-nums'] },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginVertical: 4 },
    rowMe: { justifyContent: 'flex-end' },
    rowThem: { justifyContent: 'flex-start' },
    bubbleWrap: { maxWidth: '78%', alignSelf: 'flex-start' },
    bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    bubbleMe: { borderBottomRightRadius: 5 },
    bubbleThem: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderSoft,
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
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: '100%', height: '80%' },

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
      borderColor: colors.borderSoft,
      backgroundColor: colors.surfaceElevated,
    },
    pillMine: { borderColor: withAlpha(colors.teal, 0.55), backgroundColor: withAlpha(colors.teal, 0.14) },
    pillEmoji: { fontSize: scaleFont(13) },
    pillCount: { ...typography.caption, fontSize: scaleFont(11), color: colors.textSecondary, fontWeight: '700' },
    pillCountMine: { color: colors.teal },

    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    pickerCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: spacing.sm,
    },
    pickerTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
    // Never row-reverse: an emoji row has no reading order to mirror, and the
    // same six always sit in the same places whichever language is on.
    pickerRow: { flexDirection: 'row', gap: spacing.xs },
    pickerButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
    },
    pickerButtonMine: { backgroundColor: withAlpha(colors.teal, 0.18) },
    pickerEmoji: { fontSize: scaleFont(24) },

    timestamp: { ...typography.caption, fontSize: scaleFont(10), marginTop: 3, fontWeight: '600' },
    timestampMe: { color: colors.textTertiary, textAlign: 'right' },
    timestampThem: { color: colors.textTertiary, textAlign: 'left' },
  });
