import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { scaleSpace } from '../../theme/responsive';
import { glow, type Gradient } from '../../theme/glow';

// One diameter for every empty state in the app. The arch this replaced had
// been copy-pasted into six screens and drifted to 88, 92 and 96dp on the way,
// so the same "nothing here" mark sat at three different sizes depending on
// which screen you had wandered into.
const ORB = scaleSpace(96);
const ICON = scaleSpace(32);

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

interface EmptyOrbProps {
  // The page's own ramp, so an empty state belongs to the screen it sits on
  // rather than always reading as the same brand blob. The glow is thrown from
  // the ramp's first colour, which is that page's primary.
  ramp: Gradient;
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  iconSize?: number;
}

// The disc that heads an empty list: the page's gradient with a pale icon on
// it, in a soft shadow of its own colour. Deliberately a plain circle rather
// than the design system's arch — the arch is reserved for the two places that
// want to decorate something (the login crest and the boost illustration), and
// repeated six times as a "nothing here" mark it read as a mihrab rather than
// as information.
export function EmptyOrb({ ramp, icon, size = ORB, iconSize = ICON }: EmptyOrbProps) {
  return (
    <LinearGradient
      colors={ramp}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }, glow(ramp[0], 0.5, 22, 10)]}
    >
      <Ionicons name={icon} size={iconSize} color="#FFFFFF" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  orb: { alignItems: 'center', justifyContent: 'center' },
});
