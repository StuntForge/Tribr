import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { inviteMember } from "../../api/groups";
import { colors, spacing } from "../../theme";

export default function InviteToGroupScreen({ route, navigation }: any) {
  const { groupId, userId, userName, activeTasks } = route.params as {
    groupId: string;
    userId: string;
    userName?: string;
    activeTasks?: { id: string; name: string; category: string }[];
  };
  const [suggestedTaskId, setSuggestedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => inviteMember(groupId, userId, suggestedTaskId ?? undefined),
    onSuccess: () => navigation.goBack(),
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite {userName ?? "this member"}</Text>
      <Text style={styles.subtitle}>
        They'll be notified and can accept with this task, another of their own, or decline.
      </Text>

      {activeTasks && activeTasks.length > 0 && (
        <>
          <Text style={styles.label}>Suggest one of their tasks (optional)</Text>
          <View style={styles.chipRow}>
            {activeTasks.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.chip, suggestedTaskId === t.id && styles.chipSelected]}
                onPress={() => setSuggestedTaskId(suggestedTaskId === t.id ? null : t.id)}
              >
                <Text style={[styles.chipText, suggestedTaskId === t.id && styles.chipTextSelected]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.primaryButton} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send invitation</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  error: { color: colors.danger, marginBottom: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.md },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
});
