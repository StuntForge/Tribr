import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareFlatList } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { decideApplication, Decision, getApplications, PendingApplication } from "../../api/groups";
import { jobLengthLabelShort } from "../../constants/jobLength";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { colors, spacing } from "../../theme";

export default function ApplicationsScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string };
  const queryClient = useQueryClient();
  const { data: applications, isLoading } = useQuery({
    queryKey: ["applications", groupId],
    queryFn: () => getApplications(groupId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["applications", groupId] });
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["my-groups"] });
  };

  const decide = useMutation({
    mutationFn: ({ appId, decision, reason }: { appId: string; decision: Decision; reason?: string }) =>
      decideApplication(groupId, appId, decision, reason),
    onSuccess: (_data, variables) => {
      invalidate();
      // Approving adds them to the Tribe - jump straight to it rather than
      // leaving the leader looking at a list that no longer includes what
      // they just acted on.
      if (variables.decision === "APPROVE") navigation.navigate("GroupDetail", { groupId });
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareFlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={applications}
      keyExtractor={(a: PendingApplication) => a.id}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={24}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyBody}>No pending applications.</Text>
        </View>
      }
      renderItem={({ item }: { item: PendingApplication }) => (
        <ApplicationCard
          application={item}
          busy={decide.isPending}
          pendingDecision={decide.isPending && decide.variables?.appId === item.id ? decide.variables.decision : null}
          onDecide={(decision, reason) => decide.mutate({ appId: item.id, decision, reason })}
          onPressApplicant={() => navigation.navigate("PublicProfile", { userId: item.applicant.id })}
          onPressTask={item.task ? () => navigation.navigate("TaskDetail", { taskId: item.task!.id }) : undefined}
        />
      )}
    />
  );
}

function ApplicationCard({
  application,
  busy,
  pendingDecision,
  onDecide,
  onPressApplicant,
  onPressTask,
}: {
  application: PendingApplication;
  busy: boolean;
  pendingDecision: Decision | null;
  onDecide: (decision: Decision, reason?: string) => void;
  onPressApplicant: () => void;
  onPressTask?: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.identity} onPress={onPressApplicant}>
        <Avatar name={application.applicant.firstName} photoUrl={application.applicant.photoUrl} size={32} />
        <Text style={styles.name}>{application.applicant.firstName}</Text>
        {application.applicant.isPro && <ProBadge size="tiny" />}
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </TouchableOpacity>
      {application.task && (
        <TouchableOpacity onPress={onPressTask}>
          <Text style={styles.taskLine}>
            {application.task.name} · {application.task.category} · {jobLengthLabelShort(application.task.jobLength)}
          </Text>
        </TouchableOpacity>
      )}
      {application.message && <Text style={styles.message}>"{application.message}"</Text>}

      <TouchableOpacity style={[styles.approveButton, busy && styles.buttonDisabled]} onPress={() => onDecide("APPROVE")} disabled={busy}>
        {pendingDecision === "APPROVE" ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveButtonText}>Approve</Text>}
      </TouchableOpacity>

      <TextInput
        style={styles.reasonInput}
        value={reason}
        onChangeText={setReason}
        placeholder={application.task ? "Reason (required to reject or request a different task)" : "Reason (required to reject)"}
      />
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.rejectButton, (busy || !reason.trim()) && styles.buttonDisabled]}
          onPress={() => reason.trim() && onDecide("REJECT", reason.trim())}
          disabled={busy || !reason.trim()}
        >
          {pendingDecision === "REJECT" ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.rejectButtonText}>Reject</Text>}
        </TouchableOpacity>
        {application.task && (
          <TouchableOpacity
            style={[styles.requestButton, (busy || !reason.trim()) && styles.buttonDisabled]}
            onPress={() => reason.trim() && onDecide("REQUEST_TASK", reason.trim())}
            disabled={busy || !reason.trim()}
          >
            {pendingDecision === "REQUEST_TASK" ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              <Text style={styles.requestButtonText}>Ask for a different task</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl },
  emptyBody: { fontSize: 14, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  taskLine: { fontSize: 13, color: colors.text, marginTop: spacing.xs },
  message: { fontSize: 12, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
  approveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: "center",
    marginTop: spacing.md,
  },
  approveButtonText: { color: "#fff", fontWeight: "600" },
  reasonInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  rejectButton: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: spacing.sm, alignItems: "center" },
  rejectButtonText: { color: colors.danger, fontWeight: "600", fontSize: 12 },
  requestButton: { flex: 1, borderWidth: 1, borderColor: colors.textMuted, borderRadius: 8, padding: spacing.sm, alignItems: "center" },
  requestButtonText: { color: colors.textMuted, fontWeight: "600", fontSize: 12 },
  buttonDisabled: { opacity: 0.5 },
});
