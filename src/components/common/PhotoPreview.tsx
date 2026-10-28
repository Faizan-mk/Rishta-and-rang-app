import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Taps that land this soon after opening are ignored. The photo takes a moment
// to appear, and a second impatient tap used to close the preview before it
// was ever seen — and toggling a Modal mid-fade like that is also what could
// crash it on Android.
const OPEN_GRACE_MS = 400;

/**
 * Full-screen view of one profile photo, shared by Home's card and the profile
 * screen. Shows a spinner until the photo has loaded, decodes it at screen
 * size (Android), and closes on a tap, the close button or Back.
 */
export function PhotoPreview({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const openedAt = useRef(0);

  useEffect(() => {
    if (uri) {
      openedAt.current = Date.now();
      setLoading(true);
    }
  }, [uri]);

  const close = () => {
    if (Date.now() - openedAt.current < OPEN_GRACE_MS) return;
    onClose();
  };

  return (
    <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={close}>
        {uri && (
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
            resizeMethod="resize"
            onLoadEnd={() => setLoading(false)}
          />
        )}
        {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" size="large" />}
      </Pressable>
      <View style={[styles.closeWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '80%' },
  closeWrap: { position: 'absolute', right: 16 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
