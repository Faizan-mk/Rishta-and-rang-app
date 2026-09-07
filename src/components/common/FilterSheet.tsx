import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from '../Button';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';

interface FilterSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  children: React.ReactNode;
}

export function FilterSheet({ visible, title, onClose, onApply, onReset, children }: FilterSheetProps) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    // A fixed height (rather than a content-hugging maxHeight) makes the ScrollView's
    // flex: 1 below unambiguous on every platform. react-native-web's flexShrink
    // defaults match the CSS spec (1) while native RN defaults to 0 — with only a
    // maxHeight cap and no explicit height, that gap made a long filter list scroll
    // and reveal the Apply button on web while it stayed clipped on a phone.
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, rtl && styles.rtlText]}>{title}</Text>
          <Pressable onPress={onReset} hitSlop={8}>
            <Text style={styles.resetText}>{t('common.reset')}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        <Button label={t('common.apply')} onPress={onApply} style={styles.applyButton} />
      </View>
    </BottomSheet>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // flex: 1 against the sheet's now-fixed height, not flexShrink against an
    // ambiguous auto height — see the note above.
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, flex: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { ...typography.h3, color: colors.textPrimary },
    resetText: { ...typography.caption, color: colors.teal, fontWeight: '700' },
    // flex: 1 fills whatever space is left between the header and the Apply button
    // and scrolls internally for it, identically on web and native.
    content: { flex: 1, marginBottom: spacing.md },
    applyButton: { marginTop: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
