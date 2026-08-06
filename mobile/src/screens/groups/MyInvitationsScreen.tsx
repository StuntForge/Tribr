import React, { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyInvitations, MyInvitation, respondToInvitation } from "../../api/groups";
import { getMyTasks } from "../../api/tasks";
import { colors, spacing } from "../../theme";

export default function MyInvitationsScreen() {
  const queryClient = useQueryClient();
  const { data: invitations, isLoading } = useQuery({ queryKey: ["my-invitations"], queryFn: getMyInvitations });
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: getMyTasks });
  const availableTasks = tasks?.filter((t) => t.status === "AVAILABLE") ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
    queryClient.invalidateQueries({ queryKey: ["my-groups"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const respondMutation = useMutation({
    mutationFn: ({ id, accept, taskId }: { id: string; accept: boolean; taskId?: string }) => respondToInvitation(id, accept, taskId),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={invitations}
      keyExtractor={(i) => i.id}
      ListEmptyComponent={<Text style={styles.emptyBody}>No pending invitations.</Text>}
      renderItem={({ item }) => (
        <InvitationCard
          invitation={item}
          availableTasks={availableTasks}
          busy={respondMutation.isPending}
          onAccept={(taskId) => respondMutation.mutate({ id: item.id, accept: true, taskId })}
          onDecline={() => respondMutation.mutate({ id: item.id, accept: false })}
        />
      )}
    />
  );
}

function InvitationCard({
  invitation,
  availableTasks,
  busy,
  onAccept,
  onDecline,
}: {
  invitation: MyInvitation;
  availableTasks: { id: string; name: string }[];
  busy: boolean;
  onAccept: (taskId: string) => void;
  onDecline: () => void;
}) {
  const [taskId, setTaskId] = useState<string | null>(invitation.suggestedTask?.id ?? null);

  return (
    <View style={styles.card}>
      <Text style={styles.groupName}>{invitation.group.name}</Text>
      <Text style={styles.meta}>
        {invitation.group.category ?? "Any category"} · led by {invitation.group.leaderName}
      </Text>
      {invitation.suggestedTask && <Text style={styles.meta}>Suggested task: {invitation.suggestedTask.name}</Text>}

      <Text style={styles.label}>Join with which task?</Text>
      <View style={styles.chipRow}>
        {availableTasks.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.chip, taskId === t.id && styles.chipSelected]} onPress={() => setTaskId(t.id)}>
            <Text style={[styles.chipText, taskId === t.id && styles.chipTextSelected]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => taskId && onAccept(taskId)} disabled={busy || !taskId}>
          <Text style={styles.primaryButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onDecline} disabled={busy}>
          <Text style={styles.secondaryButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  groupName: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  label: { fontSize: 12, fontWeight: "600", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  secondaryButtonText: { color: colors.danger, fontWeight: "600" },
});
