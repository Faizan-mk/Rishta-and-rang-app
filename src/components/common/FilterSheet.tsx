import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
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
    <BottomSheet visible={visible} onClose={onClose}>
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
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { ...typography.h3, color: colors.textPrimary },
    resetText: { ...typography.caption, color: colors.teal, fontWeight: '700' },
    content: { flexGrow: 0, marginBottom: spacing.md },
    applyButton: { marginTop: spacing.xs },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
