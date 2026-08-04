import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../../types/content';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';

export const MessageBubble = React.memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.row, message.fromMe ? styles.rowMe : styles.rowThem]}>
      <View style={[styles.bubble, message.fromMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.text, message.fromMe ? styles.textMe : styles.textThem]}>{message.text}</Text>
      </View>
    </View>
  );
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
  });
