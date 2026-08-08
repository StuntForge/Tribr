import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function AccountSettingsScreen({ navigation }: any) {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("EditProfile")}>
        <Text style={styles.rowText}>Edit profile</Text>
      </TouchableOpacity>

      <View style={styles.infoRow}>
        <Text style={styles.rowText}>Mobile number</Text>
        <Text style={styles.rowMeta}>{profile?.phone}</Text>
      </View>
      <Text style={styles.hint}>Your mobile number is your account's permanent identity and can't be changed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48,
  },
  infoRow: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48,
  },
  rowText: { fontSize: 15, color: colors.text, fontWeight: "600" },
  rowMeta: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 17 },
});
