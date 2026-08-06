import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { cancelAccountDeletion, requestAccountDeletion } from "../api/profile";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function AccountSettingsScreen({ navigation }: any) {
  const { profile, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onDeletePress = () => {
    Alert.alert(
      "Delete your account?",
      "If you're currently in any active groups, deletion will be held until those commitments finish. Otherwise your profile is anonymised immediately and can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  };

  const doDelete = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await requestAccountDeletion();
      if (result.deferred) {
        setNotice(`${result.message}${result.blockingGroups?.length ? ` (${result.blockingGroups.join(", ")})` : ""}`);
      } else {
        await signOut();
      }
    } catch (e: any) {
      setNotice(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onCancelDeletion = async () => {
    setBusy(true);
    try {
      await cancelAccountDeletion();
      await refreshProfile();
      setNotice("Deletion request cancelled.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("EditProfile")}>
        <Text style={styles.rowText}>Edit profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("ChangePhone")}>
        <Text style={styles.rowText}>Change mobile number</Text>
        <Text style={styles.rowMeta}>{profile?.phone}</Text>
      </TouchableOpacity>

      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={styles.hint}>
          This can be undone only if it's deferred (you're told immediately). Once it completes, it's permanent.
        </Text>
        {notice && <Text style={styles.notice}>{notice}</Text>}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.dangerButton} onPress={onDeletePress} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.dangerButtonText}>Delete my account</Text>}
          </TouchableOpacity>
          {notice?.includes("deferred") && (
            <TouchableOpacity style={styles.secondaryButton} onPress={onCancelDeletion} disabled={busy}>
              <Text style={styles.secondaryButtonText}>Cancel request</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  rowText: { fontSize: 15, color: colors.text, fontWeight: "600" },
  rowMeta: { fontSize: 13, color: colors.textMuted },
  dangerSection: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  dangerTitle: { fontSize: 15, fontWeight: "700", color: colors.danger, marginBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
  notice: { fontSize: 13, color: colors.text, marginBottom: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  dangerButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: 10, padding: spacing.sm, alignItems: "center", minHeight: 44, justifyContent: "center" },
  dangerButtonText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center", minHeight: 44, justifyContent: "center" },
  secondaryButtonText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
});
