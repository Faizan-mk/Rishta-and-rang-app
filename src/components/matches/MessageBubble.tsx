import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { ChatMessage } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MessageBubble = React.memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [previewVisible, setPreviewVisible] = useState(false);

  const bubbleStyle = [styles.bubble, message.fromMe ? styles.bubbleMe : styles.bubbleThem];
  const textColor = message.fromMe ? styles.textMe : styles.textThem;

  let content: React.ReactNode;
  if (message.kind === 'voice' && message.audioUri) {
    content = <VoiceBubble uri={message.audioUri} durationSec={message.durationSec ?? 0} fromMe={Boolean(message.fromMe)} colors={colors} />;
  } else if (message.kind === 'image' && message.imageUri) {
    content = (
      <>
        <Pressable onPress={() => setPreviewVisible(true)}>
          <Image source={{ uri: message.imageUri }} style={styles.image} />
        </Pressable>
        <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <Pressable style={styles.previewOverlay} onPress={() => setPreviewVisible(false)}>
            <Image source={{ uri: message.imageUri }} style={styles.previewImage} resizeMode="contain" />
          </Pressable>
        </Modal>
      </>
    );
  } else {
    content = <Text style={[styles.text, textColor]}>{message.text}</Text>;
  }

  return (
    <View style={[styles.row, message.fromMe ? styles.rowMe : styles.rowThem]}>
      <View>
        <View style={bubbleStyle}>{content}</View>
        <Text style={[styles.timestamp, message.fromMe ? styles.timestampMe : styles.timestampThem]}>
          {formatMessageTime(message.sentAt)}
        </Text>
      </View>
    </View>
  );
});

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
    bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    bubbleMe: { backgroundColor: colors.teal, borderBottomRightRadius: 4 },
    bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
    text: { ...typography.body },
    textMe: { color: colors.textInverse },
    textThem: { color: colors.textPrimary },
    image: { width: 200, height: 200, borderRadius: radius.md },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
    previewImage: { width: '100%', height: '80%' },
    timestamp: { ...typography.caption, fontSize: 10, marginTop: 2 },
    timestampMe: { color: colors.textTertiary, textAlign: 'right' },
    timestampThem: { color: colors.textTertiary, textAlign: 'left' },
  });
