import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cachedImageUri } from '../../services/imageCache';
import { useTheme } from '../../store/ThemeContext';
import { typography } from '../../theme';

interface SmartImageProps {
  uri?: string;
  // Used for the initials shown when there is no usable photo.
  name?: string;
  style?: StyleProp<ImageStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  // Scales the initials/icon to the box it sits in.
  size?: number;
  blurRadius?: number;
}

function initialsOf(name?: string): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

// A photo that never leaves a blank grey box behind. Three things can go wrong
// in this app and all of them used to render as nothing: a member whose photo
// URL is unreachable on this network, a member whose photo is still a local
// file:// URI from another device (the media upload is a placeholder), and a
// member with no photo at all. All three now fall back to an initials tile.
export function SmartImage({ uri, name, style, fallbackStyle, size = 28, blurRadius }: SmartImageProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  // The on-disk copy, once there is one. Until then the remote URL renders, so
  // caching never delays a photo that could already be shown — it only makes
  // the next launch free.
  const [localUri, setLocalUri] = useState<string | null>(null);

  // A new photo deserves a fresh attempt.
  useEffect(() => setFailed(false), [uri]);

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    if (!uri) return;
    cachedImageUri(uri).then((cached) => {
      if (!cancelled && cached) setLocalUri(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (!uri || failed) {
    const initials = initialsOf(name);
    return (
      <View style={[styles.fallback, { backgroundColor: colors.backgroundAlt }, style as StyleProp<ViewStyle>, fallbackStyle]}>
        {initials ? (
          <Text style={[styles.initials, { color: colors.textSecondary, fontSize: size }]}>{initials}</Text>
        ) : (
          <Ionicons name="person" size={size} color={colors.textTertiary} />
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: localUri ?? uri }}
      style={style}
      blurRadius={blurRadius}
      // A cached file that will not decode is worse than no cache at all, so a
      // failure falls back to the network copy once before giving up entirely.
      onError={() => (localUri ? setLocalUri(null) : setFailed(true))}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { ...typography.h1, fontWeight: '800' },
});
