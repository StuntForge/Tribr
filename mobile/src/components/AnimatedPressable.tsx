import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// A single animated+pressable box (not Pressable wrapping a separately-styled
// Animated.View) - splitting style across two nested views meant `style`
// (row/alignItems/etc) landed on the outer box while its actual children sat
// inside an unstyled inner box, silently collapsing every row layout that
// used this component to a stretched column.
const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export default function AnimatedPressable({
  children,
  onPress,
  style,
  disabled,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityRole?: "button" | "link" | "radio" | "none";
  accessibilityLabel?: string;
  accessibilityState?: Record<string, unknown>;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressableBase
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 14, stiffness: 300 });
        opacity.value = withSpring(0.85);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
        opacity.value = withSpring(1);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
