import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function HomeScreen() {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi {profile?.firstName ?? "there"} 👋</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>You don't have any active groups yet</Text>
        <Text style={styles.cardBody}>
          Add a task to your library from the Profile tab, then browse or create a group from the Search tab to
          get started.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  cardBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});
