import React from 'react';
import { render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../store/ThemeContext';
import { LanguageProvider } from '../../store/LanguageContext';

// react-native-safe-area-context needs a real layout pass to resolve insets,
// which never happens under the test renderer — its own jest mock is what
// resolves synchronously instead. jest.mock() is hoisted within whichever file
// calls it, so declaring it here (rather than in every test file) registers it
// for any test that imports this helper, as long as that import happens before
// the real module would otherwise be required.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Shared render wrapper for component tests: most components read colors from
// ThemeContext and copy from LanguageContext, so they throw ("useTheme must be
// used within a ThemeProvider") without both real providers around them.
// BottomSheet-based components also read safe-area insets — the mock above
// covers that. Not a test file itself (no `.test.ts(x)` suffix), so Jest's
// testMatch skips it.
export function withProviders(ui: React.ReactElement): React.ReactElement {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>{ui}</LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(ui: React.ReactElement): RenderResult {
  return render(withProviders(ui));
}
