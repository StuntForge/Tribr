import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AnimatedPressable from "./AnimatedPressable";
import { colors, radii, spacing } from "../theme";

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// The two-segment pill toggle used across the app: Active/Archived tasks,
// Updates/Action Needed notifications, List/Map browse view, etc.
export default function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedTabOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <AnimatedPressable
            key={opt.value}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(opt.value)}
          >
            <Ionicons name={opt.icon} size={16} color={active ? "#fff" : colors.primary} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{opt.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  tabTextActive: { color: "#fff" },
});
