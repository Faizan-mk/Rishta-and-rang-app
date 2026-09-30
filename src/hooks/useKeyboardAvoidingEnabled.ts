import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The `enabled` prop for a `KeyboardAvoidingView`.
 *
 * On Android edge-to-edge, the keyboard-hide event reports the keyboard's top
 * as the *window* height, which is shorter than the screen by the status bar.
 * The view measures itself against the screen, so it reads that as the keyboard
 * still covering the bottom strip and leaves a status-bar-tall blank band under
 * its content after the keyboard closes. Off while the keyboard is down, it
 * drops that padding entirely.
 *
 * Always on for iOS: its events are right, and `keyboardDidShow` arrives only
 * after the keyboard has finished animating in, which would make the content
 * trail behind it.
 */
export function useKeyboardAvoidingEnabled(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return Platform.OS !== 'android' || visible;
}
