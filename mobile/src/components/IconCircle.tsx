import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";

export default function IconCircle({
  icon,
  size = 40,
  bg = colors.primary,
  color = "#fff",
  iconSize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  bg?: string;
  color?: string;
  iconSize?: number;
}) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Ionicons name={icon} size={iconSize ?? size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
});
