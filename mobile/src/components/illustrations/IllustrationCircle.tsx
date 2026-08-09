import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

// The soft circular backdrop + small leaf/sparkle accents used behind every
// empty-state and decorative header illustration, in place of hand-drawn
// artwork we don't have assets for. A couple of Ionicons compose the "scene"
// on top (e.g. heart+person, bell+paper-plane) so each empty state still
// reads as a distinct little illustration rather than a plain icon.
export default function IllustrationCircle({
  size = 132,
  tint = colors.surfaceAlt,
  children,
  sparkles = true,
}: {
  size?: number;
  tint?: string;
  children: React.ReactNode;
  sparkles?: boolean;
}) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 132 132" style={StyleSheet.absoluteFill}>
        <Circle cx="66" cy="66" r="66" fill={tint} />
      </Svg>
      {sparkles && (
        <>
          <Ionicons name="leaf" size={16} color={colors.primaryLight} style={[styles.accent, { left: -6, bottom: 10 }]} />
          <Ionicons name="leaf" size={14} color={colors.primaryLight} style={[styles.accent, { right: -4, bottom: -2 }]} />
          <Ionicons name="sparkles" size={14} color={colors.accentLight} style={[styles.accent, { right: 4, top: 2 }]} />
        </>
      )}
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  accent: { position: "absolute", transform: [{ rotate: "-15deg" }] },
});
