import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AttendanceEntry, AttendanceStatus, completeTask, getAttendees } from "../../api/groups";
import { colors, spacing } from "../../theme";

type Draft = {
  status: AttendanceStatus;
  performance: number;
  attitude: number;
  reliability: number;
};

export default function CompleteTaskScreen({ route, navigation }: any) {
  const { groupId, taskId, taskName } = route.params as { groupId: string; taskId: string; taskName: string };
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: attendees, isLoading } = useQuery({
    queryKey: ["attendees", groupId, taskId],
    queryFn: () => getAttendees(groupId, taskId),
  });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const getDraft = (userId: string): Draft => drafts[userId] ?? { status: "ATTENDED", performance: 3, attitude: 3, reliability: 3 };
  const setDraft = (userId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [userId]: { ...getDraft(userId), ...patch } }));

  const mutation = useMutation({
    mutationFn: (attendance: AttendanceEntry[]) => completeTask(groupId, taskId, attendance),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      navigation.goBack();
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const onSubmit = () => {
    if (!attendees) return;
    const attendance: AttendanceEntry[] = attendees.map((a) => {
      const d = getDraft(a.userId);
      if (d.status === "ATTENDED") {
        return { userId: a.userId, status: "ATTENDED", performance: d.performance, attitude: d.attitude, reliability: d.reliability };
      }
      return { userId: a.userId, status: d.status };
    });
    mutation.mutate(attendance);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Complete "{taskName}"</Text>
      <Text style={styles.subtitle}>Rate everyone who confirmed availability. This stays hidden until the cycle ends.</Text>

      {attendees?.length === 0 && <Text style={styles.hint}>Nobody confirmed availability for this task.</Text>}

      {attendees?.map((a) => {
        const draft = getDraft(a.userId);
        return (
          <View key={a.userId} style={styles.card}>
            <Text style={styles.name}>{a.firstName}</Text>
            <View style={styles.chipRow}>
              {(["ATTENDED", "NO_SHOW", "VALID_REASON"] as AttendanceStatus[]).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.chip, draft.status === status && styles.chipSelected]}
                  onPress={() => setDraft(a.userId, { status })}
                >
                  <Text style={[styles.chipText, draft.status === status && styles.chipTextSelected]}>
                    {status === "ATTENDED" ? "Attended" : status === "NO_SHOW" ? "No show" : "Valid reason"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {draft.status === "ATTENDED" && (
              <View style={styles.ratingBlock}>
                <ScoreRow label="Performance" value={draft.performance} onChange={(v) => setDraft(a.userId, { performance: v })} />
                <ScoreRow label="Attitude" value={draft.attitude} onChange={(v) => setDraft(a.userId, { attitude: v })} />
                <ScoreRow label="Reliability" value={draft.reliability} onChange={(v) => setDraft(a.userId, { reliability: v })} />
              </View>
            )}
          </View>
        );
      })}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.primaryButton} onPress={onSubmit} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Complete task</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function ScoreRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreButtons}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} style={[styles.scoreButton, value === n && styles.scoreButtonSelected]} onPress={() => onChange(n)}>
            <Text style={[styles.scoreButtonText, value === n && styles.scoreButtonTextSelected]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  hint: { fontSize: 13, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  name: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  ratingBlock: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  scoreRow: { marginBottom: spacing.sm },
  scoreLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  scoreButtons: { flexDirection: "row", gap: spacing.xs },
  scoreButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scoreButtonSelected: { backgroundColor: colors.star, borderColor: colors.star },
  scoreButtonText: { color: colors.text, fontSize: 13 },
  scoreButtonTextSelected: { color: "#fff", fontWeight: "700" },
  error: { color: colors.danger, marginBottom: spacing.md },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center", marginTop: spacing.md },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
});
