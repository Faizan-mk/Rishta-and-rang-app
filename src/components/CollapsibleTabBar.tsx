import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../store/ThemeContext';
import { useTabBarAnimatedStyle, TAB_BAR_BASE_HEIGHT } from '../store/TabBarVisibilityContext';
import { typography } from '../theme';
import { scaleFont } from '../theme/responsive';
import type { Palette } from '../theme/palettes';

// Keyed by the file names under src/app/(tabs).
const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  home: { active: 'flame', inactive: 'flame-outline' },
  explore: { active: 'compass', inactive: 'compass-outline' },
  messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  profile: { active: 'menu', inactive: 'menu-outline' },
};

export function CollapsibleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const animatedStyle = useTabBarAnimatedStyle();
  const styles = makeStyles(colors, insets.bottom);

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const iconSet = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
          const badge = options.tabBarBadge;
          const tint = focused ? colors.teal : colors.textTertiary;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
            >
              <View>
                <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={24} color={tint} />
                {badge !== undefined && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 9 ? '9+' : String(badge)}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: Palette, bottomInset: number) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingBottom: bottomInset,
    },
    row: { flexDirection: 'row', height: TAB_BAR_BASE_HEIGHT, paddingTop: 8 },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
    label: { ...typography.caption, fontSize: scaleFont(10) },
    badge: {
      position: 'absolute',
      top: -4,
      right: -9,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { fontSize: scaleFont(9), fontWeight: '700', color: '#FFFFFF' },
  });
