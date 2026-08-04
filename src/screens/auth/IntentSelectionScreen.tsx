import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import type { Intent } from '../../types/user';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Button } from '../../components/common/Button';
import { StepHeader } from '../../components/common/StepHeader';
import { useLanguage } from '../../store/LanguageContext';
import { useTheme } from '../../store/ThemeContext';
import { radius, spacing, typography } from '../../theme';
import type { Palette } from '../../theme/palettes';

type Props = NativeStackScreenProps<AuthStackParamList, 'IntentSelection'>;

const OPTIONS: { key: Intent; titleKey: string; descKey: string }[] = [
  { key: 'casual', titleKey: 'intent.casualTitle', descKey: 'intent.casualDesc' },
  { key: 'serious', titleKey: 'intent.seriousTitle', descKey: 'intent.seriousDesc' },
  { key: 'matrimonial', titleKey: 'intent.matrimonialTitle', descKey: 'intent.matrimonialDesc' },
];

export function IntentSelectionScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, rtl } = useLanguage();
  const { draft } = route.params;
  const [selected, setSelected] = useState<Intent | null>(null);

  const onNext = () => {
    if (!selected) return;
    navigation.navigate('PhotoUpload', { draft: { ...draft, intent: selected } });
  };

  return (
    <ScreenContainer>
      <StepHeader total={5} current={2} onBack={() => navigation.goBack()} />
      <Text style={[styles.title, rtl && styles.rtlText]}>{t('intent.title')}</Text>
      <Text style={[styles.subtitle, rtl && styles.rtlText]}>{t('intent.subtitle')}</Text>

      {OPTIONS.map((option, index) => {
        const isSelected = selected === option.key;
        return (
          <Animated.View key={option.key} entering={FadeInUp.delay(index * 90).duration(360)}>
            <Pressable onPress={() => setSelected(option.key)} style={[styles.card, isSelected && styles.cardSelected]}>
              <Text style={[styles.cardTitle, rtl && styles.rtlText]}>{t(option.titleKey)}</Text>
              <Text style={[styles.cardDesc, rtl && styles.rtlText]}>{t(option.descKey)}</Text>
            </Pressable>
          </Animated.View>
        );
      })}

      <Button label={t('common.next')} onPress={onNext} disabled={!selected} style={styles.submit} />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
    card: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
    },
    cardSelected: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
    cardTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
    cardDesc: { ...typography.body, color: colors.textSecondary },
    submit: { marginTop: spacing.md },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  });
