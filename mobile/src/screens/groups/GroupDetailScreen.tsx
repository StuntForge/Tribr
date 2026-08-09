import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyToGroup,
  castDissolutionBallot,
  completeCycle,
  deferTask,
  disbandGroup,
  forgoTask,
  getGroup,
  getGroupKickVotes,
  getPreviousMembers,
  leaveGroup,
  removeMember,
  requestDissolution,
  startWork,
} from "../../api/groups";
import { getMyTasks } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import TaskSelectRow from "../../components/TaskSelectRow";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { colors, radii, spacing } from "../../theme";

export default function GroupDetailScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string };
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: group, isLoading } = useQuery({ queryKey: ["group", groupId], queryFn: () => getGroup(groupId) });
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: getMyTasks });
  const availableTasks = tasks?.filter((t) => t.status === "AVAILABLE") ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["my-groups"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  function useAction<T extends (...args: any[]) => Promise<any>>(fn: T) {
    return useMutation({
      mutationFn: fn,
      onSuccess: invalidate,
      onError: (e: any) => setError(e.message ?? "Something went wrong."),
    });
  }

  const applyMutation = useAction((taskId: string) => applyToGroup(groupId, taskId, message.trim() || undefined));
  const leaveMutation = useAction(() => leaveGroup(groupId));
  const disbandMutation = useAction(() => disbandGroup(groupId));
  const startWorkMutation = useAction(() => startWork(groupId));
  const deferMutation = useAction((taskId: string) => deferTask(groupId, taskId));
  const forgoMutation = useAction((taskId: string) => forgoTask(groupId, taskId));
  const completeCycleMutation = useAction((action: "DISBAND" | "START_NEW_CYCLE") => completeCycle(groupId, action));
  const requestDissolutionMutation = useAction(() => requestDissolution(groupId));
  const ballotMutation = useAction((choice: "YES" | "NO") => castDissolutionBallot(groupId, group!.dissolutionVote!.id, choice));
  const removeMemberMutation = useAction((userId: string) => removeMember(groupId, userId));

  const { data: kickVotes } = useQuery({
    queryKey: ["group-kick-votes", groupId],
    queryFn: () => getGroupKickVotes(groupId),
    enabled: !!group && group.state === "WORKING" && (group.isMember || group.isLeader),
  });

  if (isLoading || !group) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const myMembership = group.members.find((m) => m.userId === profile?.id);
  const myTaskUnsettled =
    myMembership?.currentTask && ["SUBMITTED", "APPROVED", "ACTIVE"].includes(myMembership.currentTask.status);
  const canApply = ["RECRUITING", "READY"].includes(group.state) && !myTaskUnsettled && !group.isLeader;
  const myActiveQueueTask = group.queue.find((q) => q.isActive && q.ownerId === profile?.id);

  const confirmDisband = () => {
    Alert.alert("Disband Tribe", "This can't be undone. Any pending applications will be released.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disband", style: "destructive", onPress: () => disbandMutation.mutate(undefined as never) },
    ]);
  };

  const confirmLeave = () => {
    if (group.state === "COMPLETED") {
      Alert.alert(
        "Leave this Tribe?",
        "You'll lose the option to continue into another cycle with this Tribe. No other downside.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => leaveMutation.mutate(undefined as never) },
        ]
      );
      return;
    }
    leaveMutation.mutate(undefined as never);
  };

  const confirmRemoveMember = (userId: string, firstName: string | null) => {
    Alert.alert(`Kick ${firstName}?`, "They'll be taken out of the Tribe and their current task freed up.", [
      { text: "Cancel", style: "cancel" },
      { text: "Kick", style: "destructive", onPress: () => removeMemberMutation.mutate(userId) },
    ]);
  };

  const canManageMembers = group.isLeader && ["RECRUITING", "READY"].includes(group.state);
  const canVoteKick = group.state === "WORKING" && (group.isMember || group.isLeader);
  const openKickVotes = kickVotes?.filter((v) => v.outcome == null) ?? [];

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{group.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{group.state}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {group.categories.length > 0 ? group.categories.map((c) => c.name).join(", ") : "Any category"} ·{" "}
        {group.memberCount}/{group.sizeMax} members · Cycle {group.currentCycleNumber}
        {group.averageMemberRating != null ? ` · ★ ${group.averageMemberRating.toFixed(1)}` : ""}
      </Text>
      {(group.verifiedOnly || group.minRating != null) && (
        <Text style={styles.requirementMeta}>
          Requires: {group.verifiedOnly ? "Verified members" : ""}
          {group.verifiedOnly && group.minRating != null ? " · " : ""}
          {group.minRating != null ? `${group.minRating.toFixed(1)}★ minimum rating` : ""}
        </Text>
      )}
      <Text style={styles.description}>{group.description}</Text>

      {(group.isMember || group.isLeader) && (
        <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => navigation.navigate("GroupChat", { groupId })}>
          <Text style={styles.secondaryButtonText}>💬 Tribe chat</Text>
        </TouchableOpacity>
      )}

      {group.isLeader && (group.pendingApplicationCount ?? 0) > 0 && (
        <TouchableOpacity
          style={styles.banner}
          onPress={() => navigation.navigate("Applications", { groupId })}
        >
          <Text style={styles.bannerText}>Review {group.pendingApplicationCount} pending application(s) →</Text>
        </TouchableOpacity>
      )}

      {group.isLeader && ["RECRUITING", "READY"].includes(group.state) && (
        <Section title="Recruit">
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryButtonSmall}
              onPress={() => navigation.navigate("SearchMembers", { groupIdToInviteTo: groupId })}
            >
              <Text style={styles.secondaryButtonText}>Find & invite members</Text>
            </TouchableOpacity>
          </View>
          <PreviousMembersQuickInvite groupId={groupId} navigation={navigation} />
        </Section>
      )}

      <Section title="Members">
        {openKickVotes.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={styles.banner}
            onPress={() => navigation.navigate("KickVote", { voteId: v.id })}
          >
            <Text style={styles.bannerText}>Vote in progress to remove {v.target.firstName} →</Text>
          </TouchableOpacity>
        ))}
        {group.members.map((m) => {
          const isSelf = m.userId === profile?.id;
          const showRemove = canManageMembers && !m.isLeader && !isSelf;
          const showVoteKick =
            canVoteKick && !m.isLeader && !isSelf && !openKickVotes.some((v) => v.target.id === m.userId);
          return (
            <View key={m.userId} style={styles.memberRow}>
              <TouchableOpacity
                style={styles.memberIdentity}
                onPress={() => navigation.navigate("PublicProfile", { userId: m.userId })}
                disabled={isSelf}
              >
                <Avatar name={m.firstName} photoUrl={null} size={32} />
                <Text style={styles.memberName}>
                  {m.firstName} {m.isLeader ? "👑" : ""}
                </Text>
                {m.rating != null && (
                  <View style={styles.memberRatingPill}>
                    <Ionicons name="star" size={11} color={colors.star} />
                    <Text style={styles.memberRatingText}>{m.rating.toFixed(1)}</Text>
                  </View>
                )}
                {m.isPro && <ProBadge size="tiny" />}
                <View style={{ flex: 1 }} />
                {!isSelf && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
              </TouchableOpacity>
              <View style={styles.memberBottomRow}>
                {m.currentTask ? (
                  <TouchableOpacity
                    style={styles.taskChip}
                    onPress={() => navigation.navigate("TaskDetail", { taskId: m.currentTask!.id })}
                  >
                    {m.currentTask.status === "ARCHIVED" ? (
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    ) : group.queue.find((q) => q.taskId === m.currentTask!.id)?.isActive ? (
                      <View style={styles.activeDot} />
                    ) : null}
                    <Text
                      style={[
                        styles.memberTaskLink,
                        m.currentTask.status === "ARCHIVED" && styles.memberTaskDone,
                        group.queue.find((q) => q.taskId === m.currentTask!.id)?.isActive && styles.memberTaskActive,
                      ]}
                      numberOfLines={1}
                    >
                      {m.currentTask.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.memberTask}>No task this cycle</Text>
                )}
                <View style={{ flex: 1 }} />
                {showRemove && (
                  <TouchableOpacity onPress={() => confirmRemoveMember(m.userId, m.firstName)}>
                    <Text style={styles.memberActionText}>Kick</Text>
                  </TouchableOpacity>
                )}
                {showVoteKick && (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("StartKickVote", { groupId, targetUserId: m.userId, targetName: m.firstName })
                    }
                  >
                    <Text style={styles.memberActionText}>Vote to kick</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </Section>

      {group.progress && group.progress.total > 0 && (group.state === "WORKING" || group.state === "COMPLETED") && (
        <Section title="Cycle progress">
          <View style={styles.progressBarTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: group.progress.total, now: group.progress.completed }}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round(((group.progress.completed + group.progress.forgone) / group.progress.total) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.hint}>
            {group.progress.completed} of {group.progress.total} task{group.progress.total === 1 ? "" : "s"} completed
            {group.progress.forgone > 0 ? ` (${group.progress.forgone} forgone)` : ""}
          </Text>
        </Section>
      )}

      {group.state === "WORKING" && group.queue.length > 0 && (
        <Section title="Task order">
          {group.queue.map((q, i) => (
            <View key={q.taskId} style={[styles.queueRow, q.isActive && styles.queueRowActive]}>
              <Text style={styles.queuePosition}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {q.taskName} — {q.ownerName}
                </Text>
                <Text style={styles.memberTask}>{q.isActive ? "Active now" : q.status}</Text>
              </View>
              {q.isActive && (
                <TouchableOpacity
                  style={styles.secondaryButtonSmall}
                  onPress={() => navigation.navigate("TaskSchedule", { groupId, taskId: q.taskId, taskName: q.taskName })}
                >
                  <Text style={styles.secondaryButtonText}>Schedule</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Section>
      )}

      {myActiveQueueTask && (
        <Section title="Your task is active">
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryButtonSmall}
              onPress={() =>
                navigation.navigate("CompleteTask", { groupId, taskId: myActiveQueueTask.taskId, taskName: myActiveQueueTask.taskName })
              }
            >
              <Text style={styles.primaryButtonText}>Mark complete</Text>
            </TouchableOpacity>
            {group.queue.length > 1 && (
              <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => deferMutation.mutate(myActiveQueueTask.taskId)}>
                <Text style={styles.secondaryButtonText}>Defer</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => forgoMutation.mutate(myActiveQueueTask.taskId)}>
              <Text style={styles.secondaryButtonText}>Forgo this cycle</Text>
            </TouchableOpacity>
          </View>
        </Section>
      )}

      {canApply && (
        <Section title="Apply to join">
          {availableTasks.length === 0 ? (
            <Text style={styles.hint}>Add an available task from your Task Library first.</Text>
          ) : (
            <>
              {availableTasks.map((t) => (
                <TaskSelectRow
                  key={t.id}
                  task={t}
                  selected={selectedTaskId === t.id}
                  onSelect={() => setSelectedTaskId(t.id)}
                  navigation={navigation}
                />
              ))}
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Optional message to the Tribe leader"
              />
              <TouchableOpacity
                style={styles.primaryButtonSmall}
                onPress={() => selectedTaskId && applyMutation.mutate(selectedTaskId)}
                disabled={!selectedTaskId}
              >
                <Text style={styles.primaryButtonText}>Apply</Text>
              </TouchableOpacity>
            </>
          )}
        </Section>
      )}

      {group.state === "WORKING" && (
        <Section title="Dissolution">
          {group.dissolutionVote ? (
            <>
              <Text style={styles.hint}>
                A member requested dissolution. Voting closes {new Date(group.dissolutionVote.endsAt).toLocaleString()}.
                Not voting counts as Yes.
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => ballotMutation.mutate("YES")}>
                  <Text style={styles.secondaryButtonText}>Vote Yes, dissolve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => ballotMutation.mutate("NO")}>
                  <Text style={styles.secondaryButtonText}>Vote No, keep going</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            (group.isMember || group.isLeader) && (
              <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => requestDissolutionMutation.mutate(undefined as never)}>
                <Text style={styles.secondaryButtonText}>Request dissolution</Text>
              </TouchableOpacity>
            )
          )}
        </Section>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Section title="Actions">
        <View style={styles.actionRow}>
          {group.isLeader && ["RECRUITING", "READY"].includes(group.state) && (
            <>
              <TouchableOpacity
                style={[styles.primaryButtonSmall, group.state !== "READY" && styles.buttonDisabled]}
                onPress={() => startWorkMutation.mutate(undefined as never)}
                disabled={group.state !== "READY"}
              >
                <Text style={styles.primaryButtonText}>Start Work</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerButtonSmall} onPress={confirmDisband}>
                <Text style={styles.dangerButtonText}>Disband</Text>
              </TouchableOpacity>
            </>
          )}
          {group.isLeader && group.state === "COMPLETED" && (
            <>
              <TouchableOpacity
                style={styles.primaryButtonSmall}
                onPress={() => completeCycleMutation.mutate("START_NEW_CYCLE")}
              >
                <Text style={styles.primaryButtonText}>Start new cycle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerButtonSmall} onPress={() => completeCycleMutation.mutate("DISBAND")}>
                <Text style={styles.dangerButtonText}>End Tribe & disband</Text>
              </TouchableOpacity>
            </>
          )}
          {!group.isLeader && group.isMember && ["RECRUITING", "READY", "COMPLETED"].includes(group.state) && (
            <TouchableOpacity style={styles.dangerButtonSmall} onPress={confirmLeave}>
              <Text style={styles.dangerButtonText}>Leave Tribe</Text>
            </TouchableOpacity>
          )}
          {group.state === "DISBANDED" && <Text style={styles.hint}>This Tribe has ended.</Text>}
        </View>
        {group.isLeader && group.state !== "READY" && ["RECRUITING", "READY"].includes(group.state) && (
          <Text style={styles.hint}>Start Work unlocks once at least {group.sizeMin} members have an approved task.</Text>
        )}
      </Section>
    </KeyboardAwareScrollView>
  );
}

// 7.10 - previous members of this group are easy to invite back before recruiting strangers.
function PreviousMembersQuickInvite({ groupId, navigation }: { groupId: string; navigation: any }) {
  const { data: previousMembers } = useQuery({ queryKey: ["previous-members", groupId], queryFn: () => getPreviousMembers(groupId) });

  if (!previousMembers || previousMembers.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.hint}>Previous members of this Tribe:</Text>
      <View style={styles.actionRow}>
        {previousMembers.map((m) => (
          <TouchableOpacity
            key={m.userId}
            style={styles.secondaryButtonSmall}
            onPress={() => navigation.navigate("PublicProfile", { userId: m.userId, groupIdToInviteTo: groupId })}
          >
            <Text style={styles.secondaryButtonText}>+ {m.firstName}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, flex: 1 },
  badge: { borderWidth: 1, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600", color: colors.primary },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  requirementMeta: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 2 },
  description: { fontSize: 14, color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  banner: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, marginTop: spacing.md },
  bannerText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  memberRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  memberIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  memberRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  memberRatingText: { fontSize: 11, fontWeight: "700", color: colors.text },
  memberBottomRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  memberActionText: { fontSize: 12, fontWeight: "600", color: colors.danger },
  memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
  memberTask: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  taskChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 150,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  memberTaskLink: { fontSize: 12, color: colors.primary, fontWeight: "600", flexShrink: 1 },
  memberTaskDone: { textDecorationLine: "line-through", color: colors.primary },
  memberTaskActive: { color: colors.primaryDark, fontWeight: "700" },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  queueRowActive: { backgroundColor: "#EAF4EE", borderRadius: 8, paddingHorizontal: spacing.sm },
  queuePosition: { fontSize: 14, fontWeight: "700", color: colors.textMuted, width: 20 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  progressBarTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden", marginBottom: spacing.xs },
  progressBarFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 5 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, marginTop: spacing.md },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  primaryButtonSmall: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  secondaryButtonSmall: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  dangerButtonSmall: { borderWidth: 1, borderColor: colors.danger, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  dangerButtonText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  buttonDisabled: { opacity: 0.4 },
});
