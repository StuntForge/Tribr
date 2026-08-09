import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, type } from "../theme";

// The icon-chip + label row used above every form field across Create
// Profile/Group/Task and Edit Profile, so form sections read consistently.
export default function FieldLabel({
  icon,
  label,
  required,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  required?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.chip}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={type.bodyMedium}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  chip: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  required: { color: colors.accent },
});
