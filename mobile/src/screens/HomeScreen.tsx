import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function HomeScreen({ navigation }: any) {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi {profile?.firstName ?? "there"} 👋</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>You don't have any active groups yet</Text>
        <Text style={styles.cardBody}>
          Start by adding a task you'd like help with. Once you have one, you can browse or create a group from
          the Search tab.
        </Text>
        <TouchableOpacity
          style={styles.cardButton}
          onPress={() => navigation.navigate("Profile", { screen: "TaskLibrary" })}
        >
          <Text style={styles.cardButtonText}>Add a task</Text>
        </TouchableOpacity>
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
  cardButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  cardButtonText: { color: "#fff", fontWeight: "600" },
});
