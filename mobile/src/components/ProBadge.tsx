import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";

export default function ProBadge({ size = "small" }: { size?: "small" | "tiny" }) {
  const isTiny = size === "tiny";
  return (
    <View style={[styles.badge, isTiny && styles.badgeTiny]}>
      <Ionicons name="diamond" size={isTiny ? 9 : 11} color={colors.proAccent} />
      <Text style={[styles.text, isTiny && styles.textTiny]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primaryDark,
    borderRadius: radii.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeTiny: { paddingVertical: 2, paddingHorizontal: 5, gap: 2 },
  text: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  textTiny: { fontSize: 9 },
});
