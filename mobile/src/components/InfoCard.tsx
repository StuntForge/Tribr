import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import IconCircle from "./IconCircle";
import { colors, radii, spacing, type } from "../theme";

// The sage info card used for "Better together", "What you'll see here",
// "Why favourite members?" etc - a card holding one or more icon+title+body
// rows, optionally divided.
export function InfoCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function InfoCardRow({
  icon,
  title,
  body,
  divider,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title?: string;
  body: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <IconCircle icon={icon} size={40} bg={colors.primary} />
      <View style={styles.rowText}>
        {title ? <Text style={styles.rowTitle}>{title}</Text> : null}
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  row: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs },
  rowText: { flex: 1, justifyContent: "center" },
  rowTitle: { ...type.bodyMedium, marginBottom: 2 },
  rowBody: { ...type.small, lineHeight: 18 },
});
