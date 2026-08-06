import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export default function PlaceholderScreen({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  body: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
});
