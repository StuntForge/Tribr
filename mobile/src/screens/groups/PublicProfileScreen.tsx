import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { blockUser, getPublicProfile, getUserTasks, PublicTaskSummary, reportUser } from "../../api/profile";
import { addFavourite, getFavourites, removeFavourite } from "../../api/search";
import { inviteMember } from "../../api/groups";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { colors, radii, shadows, spacing, type } from "../../theme";

const REPORT_REASONS = ["Inappropriate behaviour", "No-show / unreliable", "Safety concern", "Spam or scam", "Other"];

export default function PublicProfileScreen({ route, navigation }: any) {
  const { userId, groupIdToInviteTo } = route.params as { userId: string; groupIdToInviteTo?: string };
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");

  const { data: profile, isLoading } = useQuery({ queryKey: ["public-profile", userId], queryFn: () => getPublicProfile(userId) });
  const { data: favourites } = useQuery({ queryKey: ["favourites"], queryFn: getFavourites });
  const isFavourite = favourites?.some((f) => f.userId === userId) ?? false;

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["user-tasks", userId],
    queryFn: () => getUserTasks(userId),
    enabled: Boolean(groupIdToInviteTo),
  });

  const favouriteMutation = useMutation({
    mutationFn: () => (isFavourite ? removeFavourite(userId) : addFavourite(userId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favourites"] }),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: () => {
      Alert.alert("Blocked");
      navigation.goBack();
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => reportUser(userId, reportReason!, reportDetails.trim() || undefined),
    onSuccess: () => {
      setReportOpen(false);
      setReportReason(null);
      setReportDetails("");
      Alert.alert("Report submitted", "Thanks for letting us know - our team will take a look.");
    },
  });

  const confirmBlock = () => {
    Alert.alert("Block this member?", "They won't be able to invite, message or apply to your Tribes.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => blockMutation.mutate() },
    ]);
  };

  if (isLoading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 160" pointerEvents="none">
          <Circle cx="20" cy="0" r="70" fill={colors.primaryDark} opacity={0.3} />
          <Circle cx="300" cy="150" r="90" fill={colors.accent} opacity={0.2} />
        </Svg>
        <View style={styles.avatarRing}>
          <Avatar name={profile.firstName} photoUrl={profile.profilePhotoUrl} size={92} />
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.firstName}</Text>
          {profile.isPro && <ProBadge size="small" />}
        </View>
        <Text style={styles.meta}>
          {profile.age} · {profile.gender}
          {profile.approxDistanceMiles != null ? ` · ${profile.approxDistanceMiles} mi away` : ""}
        </Text>
      </View>

      <View style={styles.ratingCard}>
        <View style={styles.ratingHeaderRow}>
          <Ionicons name="star" size={20} color={colors.star} />
          <Text style={styles.ratingHeaderText}>
            {profile.overallRating != null ? profile.overallRating.toFixed(1) : "No ratings yet"}
          </Text>
        </View>
        <View style={styles.ratingBreakdownRow}>
          <View style={styles.ratingBreakdownItem}>
            <Ionicons name="hammer" size={14} color={colors.primary} />
            <Text style={styles.ratingBreakdownText}>
              Worker {profile.workerRating != null ? profile.workerRating.toFixed(1) : "—"}
            </Text>
          </View>
          <View style={styles.ratingBreakdownItem}>
            <Ionicons name="home" size={14} color={colors.primary} />
            <Text style={styles.ratingBreakdownText}>
              Host {profile.hostRating != null ? profile.hostRating.toFixed(1) : "—"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Ionicons name="checkmark-done" size={18} color={colors.primary} />
          <Text style={styles.statValue}>{profile.completedTasksCount}</Text>
          <Text style={styles.statLabel}>Tasks done</Text>
        </View>
        <View style={styles.statTile}>
          <Ionicons name="refresh" size={18} color={colors.primary} />
          <Text style={styles.statValue}>{profile.completedCycles}</Text>
          <Text style={styles.statLabel}>Cycles done</Text>
        </View>
      </View>

      <View style={styles.bioCard}>
        <Ionicons name="chatbox-ellipses" size={16} color={colors.accent} style={{ marginBottom: 4 }} />
        <Text style={styles.bio}>{profile.bio}</Text>
      </View>

      {groupIdToInviteTo ? (
        <View style={styles.taskSection}>
          <Text style={styles.taskSectionTitle}>
            {profile.firstName}'s tasks - choose one to invite them with
          </Text>
          {tasksLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          ) : tasks && tasks.length > 0 ? (
            tasks.map((t) => (
              <TaskInviteRow key={t.id} task={t} groupId={groupIdToInviteTo} userId={userId} navigation={navigation} />
            ))
          ) : (
            <Text style={styles.emptyTasks}>{profile.firstName} doesn't have any tasks to invite them with yet.</Text>
          )}
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, favouriteMutation.isPending && styles.buttonDisabled]}
            onPress={() => !favouriteMutation.isPending && favouriteMutation.mutate()}
            disabled={favouriteMutation.isPending}
          >
            {favouriteMutation.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>{isFavourite ? "★ Favourited" : "☆ Favourite"}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={() => setReportOpen(true)}>
          <Text style={styles.linkDanger}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmBlock}>
          <Text style={styles.linkDanger}>Block</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={reportOpen} animationType="slide" transparent onRequestClose={() => setReportOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Report {profile.firstName}</Text>
            <Text style={styles.modalHint}>Choose a reason and add any details that will help our team review it.</Text>

            <View style={styles.chipRow}>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonChip, reportReason === r && styles.reasonChipSelected]}
                  onPress={() => setReportReason(r)}
                >
                  <Text style={[styles.reasonChipText, reportReason === r && styles.reasonChipTextSelected]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.detailsInput}
              value={reportDetails}
              onChangeText={setReportDetails}
              placeholder="Add details (optional)"
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setReportOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, !reportReason && styles.modalSubmitButtonDisabled]}
                disabled={!reportReason || reportMutation.isPending}
                onPress={() => reportMutation.mutate()}
              >
                {reportMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function TaskInviteRow({
  task,
  groupId,
  userId,
  navigation,
}: {
  task: PublicTaskSummary;
  groupId: string;
  userId: string;
  navigation: any;
}) {
  const queryClient = useQueryClient();
  const inviteMutation = useMutation({
    mutationFn: () => inviteMember(groupId, userId, task.id),
    onSuccess: () => {
      Alert.alert("Invitation sent");
      queryClient.invalidateQueries({ queryKey: ["previous-members"] });
      navigation.goBack();
    },
  });

  const canInvite = task.status === "AVAILABLE";

  return (
    <View style={styles.taskRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.taskRowTitle}>{task.name}</Text>
        <Text style={styles.taskRowCategory}>{task.category.name}</Text>
        <Text style={styles.taskRowDescription} numberOfLines={2}>
          {task.description}
        </Text>
      </View>
      <View style={styles.taskRowActions}>
        <TouchableOpacity style={styles.viewButton} onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}>
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inviteRowButton, !canInvite && styles.inviteRowButtonDisabled]}
          onPress={() => inviteMutation.mutate()}
          disabled={!canInvite || inviteMutation.isPending}
        >
          {inviteMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.inviteRowButtonText}>{canInvite ? "Invite" : "Unavailable"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonDisabled: { opacity: 0.6 },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    overflow: "hidden",
    ...shadows.raised,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    marginBottom: spacing.sm,
    alignSelf: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: 2 },
  name: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" },
  meta: { color: "rgba(255,255,255,0.8)", fontSize: 13, textAlign: "center", marginTop: spacing.xs },
  ratingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  ratingHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  ratingHeaderText: { fontSize: 18, fontWeight: "700", color: colors.text },
  ratingBreakdownRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  ratingBreakdownItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingBreakdownText: { ...type.small },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  statTile: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.text },
  statLabel: { ...type.caption },
  bioCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  bio: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
  taskSection: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  taskSectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  emptyTasks: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
  taskRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.card,
  },
  taskRowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  taskRowCategory: { fontSize: 11, fontWeight: "600", color: colors.primary, marginTop: 2 },
  taskRowDescription: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  taskRowActions: { justifyContent: "center", gap: spacing.xs },
  viewButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  viewButtonText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  inviteRowButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  inviteRowButtonDisabled: { backgroundColor: colors.border },
  inviteRowButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, marginHorizontal: spacing.lg, justifyContent: "center" },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  secondaryButtonText: { color: colors.primary, fontWeight: "600" },
  linkDanger: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  modalHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  reasonChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  reasonChipSelected: { backgroundColor: colors.danger, borderColor: colors.danger },
  reasonChipText: { color: colors.text, fontSize: 13 },
  reasonChipTextSelected: { color: "#fff", fontWeight: "600" },
  detailsInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: spacing.md,
  },
  modalActions: { flexDirection: "row", gap: spacing.sm },
  modalCancelButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, alignItems: "center" },
  modalCancelText: { color: colors.text, fontWeight: "600" },
  modalSubmitButton: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, padding: spacing.md, alignItems: "center" },
  modalSubmitButtonDisabled: { opacity: 0.5 },
  modalSubmitText: { color: "#fff", fontWeight: "700" },
});
