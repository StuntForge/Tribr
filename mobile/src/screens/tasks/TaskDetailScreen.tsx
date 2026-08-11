import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getPublicTask, withdrawTaskApplication } from "../../api/tasks";
import { jobLengthLabel } from "../../constants/jobLength";
import { inviteMember } from "../../api/groups";
import { useAuth } from "../../context/AuthContext";
import PhotoGallery from "../../components/PhotoGallery";
import { colors, radii, shadows, spacing, type } from "../../theme";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  AVAILABLE: "Available",
  SUBMITTED: "Submitted to Tribe",
  APPROVED: "Assigned",
  ACTIVE: "Active in Tribe",
  COMPLETED: "Completed",
  ARCHIVED: "Completed",
  FORGONE: "Forgone this cycle",
  USER_ARCHIVED: "Archived",
};

export default function TaskDetailScreen({ route, navigation }: any) {
  const { taskId, groupIdToInviteTo, invitedUserId } = route.params as {
    taskId: string;
    groupIdToInviteTo?: string;
    invitedUserId?: string;
  };
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useQuery({ queryKey: ["public-task", taskId], queryFn: () => getPublicTask(taskId) });

  const inviteMutation = useMutation({
    mutationFn: () => inviteMember(groupIdToInviteTo!, invitedUserId!, taskId),
    onSuccess: () => navigation.goBack(),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawTaskApplication(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      navigation.goBack();
    },
  });

  const confirmWithdraw = () => {
    Alert.alert("Withdraw application?", "This frees up this task so you can submit it elsewhere.", [
      { text: "Cancel", style: "cancel" },
      { text: "Withdraw", style: "destructive", onPress: () => withdrawMutation.mutate() },
    ]);
  };

  if (isLoading || !task) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const canInvite = Boolean(groupIdToInviteTo && invitedUserId);
  const isOwnTask = task.ownerId === profile?.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{task.name}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{STATUS_LABEL[task.status] ?? task.status}</Text>
        </View>
      </View>

      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>{task.category.name}</Text>
      </View>

      {task.ownerFirstName && <Text style={styles.owner}>Owned by {task.ownerFirstName}</Text>}

      {isOwnTask && task.groupId && task.groupName && (
        <TouchableOpacity
          style={styles.submittedToRow}
          onPress={() => navigation.navigate("GroupDetail", { groupId: task.groupId })}
        >
          <Ionicons name="people" size={15} color={colors.primary} />
          <Text style={styles.submittedToText}>Submitted to {task.groupName}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.primary} />
        </TouchableOpacity>
      )}

      {isOwnTask && task.status === "SUBMITTED" && (
        <TouchableOpacity
          style={[styles.withdrawButton, withdrawMutation.isPending && styles.inviteButtonDisabled]}
          onPress={confirmWithdraw}
          disabled={withdrawMutation.isPending}
        >
          {withdrawMutation.isPending ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.withdrawButtonText}>Withdraw application</Text>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Description</Text>
      <Text style={styles.body}>{task.description}</Text>

      <Text style={styles.label}>Job length</Text>
      <Text style={styles.body}>{jobLengthLabel(task.jobLength)}</Text>

      {task.locationLabel && (
        <>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.body}>{task.locationLabel}</Text>
        </>
      )}

      {task.photos.length > 0 && (
        <>
          <Text style={styles.label}>Photos</Text>
          <PhotoGallery photos={task.photos} />
        </>
      )}

      {canInvite && (
        <TouchableOpacity
          style={[styles.inviteButton, inviteMutation.isPending && styles.inviteButtonDisabled]}
          onPress={() => inviteMutation.mutate()}
          disabled={inviteMutation.isPending || task.status !== "AVAILABLE"}
        >
          {inviteMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="person-add" size={18} color="#fff" />
              <Text style={styles.inviteButtonText}>
                {task.status === "AVAILABLE" ? "Invite to join with this task" : "Task not available"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
      {inviteMutation.isError && (
        <Text style={styles.error}>{(inviteMutation.error as any)?.message ?? "Something went wrong."}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  title: { ...type.h2, flex: 1 },
  statusBadge: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  owner: { ...type.caption, marginTop: spacing.sm },
  submittedToRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  submittedToText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  withdrawButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.md,
  },
  withdrawButtonText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg },
  body: { ...type.body, lineHeight: 21 },
  inviteButton: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    ...shadows.raised,
  },
  inviteButtonDisabled: { opacity: 0.6 },
  inviteButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center" },
});
