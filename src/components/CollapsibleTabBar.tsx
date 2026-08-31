import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../store/ThemeContext';
import { useAuth } from '../store/AuthContext';
import { useTabBarAnimatedStyle, TAB_BAR_BASE_HEIGHT } from '../store/TabBarVisibilityContext';
import { radius, typography } from '../theme';
import { scaleFont } from '../theme/responsive';
import { glow, modeAccent, withAlpha, type Gradient } from '../theme/glow';
import type { Palette } from '../theme/palettes';

// Keyed by the file names under src/app/(tabs).
const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  home: { active: 'flame', inactive: 'flame-outline' },
  explore: { active: 'compass', inactive: 'compass-outline' },
  messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  profile: { active: 'menu', inactive: 'menu-outline' },
};

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

export function CollapsibleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const animatedStyle = useTabBarAnimatedStyle();
  const styles = makeStyles(colors, insets.bottom);
  // The bar wears whichever deck the member is browsing, so the app's accent is
  // the same colour top to bottom.
  const accent = modeAccent(colors, user?.activeMode ?? 'dating');

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      {/* A hairline of accent along the top edge instead of a grey rule. */}
      <LinearGradient colors={accent.ramp} start={GRADIENT_START} end={GRADIENT_END} style={styles.topRule} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const iconSet = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              icon={focused ? iconSet.active : iconSet.inactive}
              label={label}
              badge={badge}
              accent={accent.ramp}
              accentColor={accent.primary}
              colors={colors}
              styles={styles}
              onPress={onPress}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

// The focused tab rises into a lit gradient pod. It is the only strong colour in
// the bar, so where you are is legible without reading the labels.
function TabItem({
  focused,
  icon,
  label,
  badge,
  accent,
  accentColor,
  colors,
  styles,
  onPress,
}: {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge: number | string | undefined;
  accent: Gradient;
  accentColor: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}) {
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 220 });
  }, [focused, lift]);

  const podStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 3 }, { scale: 0.86 + lift.value * 0.14 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <Animated.View style={podStyle}>
        {focused ? (
          <LinearGradient
            colors={accent}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={[styles.pod, glow(accentColor, 0.6, 14, 7)]}
          >
            <Ionicons name={icon} size={22} color="#FFFFFF" />
          </LinearGradient>
        ) : (
          <View style={styles.podIdle}>
            <Ionicons name={icon} size={22} color={colors.textTertiary} />
          </View>
        )}
        {badge !== undefined && (
          <View style={[styles.badge, glow(colors.danger, 0.7, 8, 4)]}>
            <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 9 ? '9+' : String(badge)}</Text>
          </View>
        )}
      </Animated.View>
      <Text
        style={[styles.label, { color: focused ? accentColor : colors.textTertiary }, focused && styles.labelFocused]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette, bottomInset: number) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surfaceElevated,
      paddingBottom: bottomInset,
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      elevation: 16,
    },
    topRule: { height: 2, opacity: 0.85 },
    row: { flexDirection: 'row', height: TAB_BAR_BASE_HEIGHT, paddingTop: 6 },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
    pod: {
      width: 44,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    podIdle: {
      width: 44,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { ...typography.caption, fontSize: scaleFont(10), fontWeight: '600' },
    labelFocused: { fontWeight: '800' },
    badge: {
      position: 'absolute',
      top: -3,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: colors.surfaceElevated,
    },
    badgeText: { fontSize: scaleFont(9), fontWeight: '800', color: '#FFFFFF' },
  });
