import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../store/ThemeContext';
import { useLanguage } from '../../store/LanguageContext';
import { spacing, typography } from '../../theme';

// Live checklist under a password field — the five checks isStrongPassword
// makes, so the rule the user is being held to is the rule they can see.
export function PasswordRequirements({ password }: { password: string }) {
  const { colors } = useTheme();
  const { t, rtl } = useLanguage();
  const checks = [
    [password.length >= 8, t('signup.passwordRequirementLength')],
    [/[a-z]/.test(password), t('signup.passwordRequirementLower')],
    [/[A-Z]/.test(password), t('signup.passwordRequirementUpper')],
    [/\d/.test(password), t('signup.passwordRequirementNumber')],
    [/[^A-Za-z0-9]/.test(password), t('signup.passwordRequirementSpecial')],
  ] as const;

  return (
    <View style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
      {checks.map(([valid, label]) => (
        <Text key={label} style={{ ...typography.caption, color: valid ? colors.teal : colors.textTertiary, marginBottom: 2, ...(rtl ? { textAlign: 'right', writingDirection: 'rtl' as const } : {}) }}>
          {valid ? '✓' : '○'} {label}
        </Text>
      ))}
    </View>
  );
}
