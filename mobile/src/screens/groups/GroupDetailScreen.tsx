import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyToGroup,
  castDissolutionBallot,
  completeCycle,
  deferTask,
  disbandGroup,
  forgoTask,
  getGroup,
  getPreviousMembers,
  inviteMember,
  leaveGroup,
  requestDissolution,
  startWork,
} from "../../api/groups";
import { getMyTasks } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing } from "../../theme";

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
    Alert.alert("Disband group", "This can't be undone. Any pending applications will be released.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disband", style: "destructive", onPress: () => disbandMutation.mutate(undefined as never) },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{group.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{group.state}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {group.category?.name ?? "Any category"} · {group.memberCount}/{group.sizeMax} members · Cycle{" "}
        {group.currentCycleNumber}
      </Text>
      <Text style={styles.description}>{group.description}</Text>

      {(group.isMember || group.isLeader) && (
        <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => navigation.navigate("GroupChat", { groupId })}>
          <Text style={styles.secondaryButtonText}>💬 Group chat</Text>
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
          <PreviousMembersQuickInvite groupId={groupId} />
        </Section>
      )}

      <Section title="Members">
        {group.members.map((m) => (
          <TouchableOpacity
            key={m.userId}
            style={styles.memberRow}
            onPress={() => navigation.navigate("PublicProfile", { userId: m.userId })}
            disabled={m.userId === profile?.id}
          >
            <Text style={styles.memberName}>
              {m.firstName} {m.isLeader ? "👑" : ""}
            </Text>
            <Text style={styles.memberTask}>{m.currentTask ? `${m.currentTask.name} · ${m.currentTask.status}` : "No task this cycle"}</Text>
          </TouchableOpacity>
        ))}
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
              <View style={styles.chipRow}>
                {availableTasks.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, selectedTaskId === t.id && styles.chipSelected]}
                    onPress={() => setSelectedTaskId(t.id)}
                  >
                    <Text style={[styles.chipText, selectedTaskId === t.id && styles.chipTextSelected]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Optional message to the group leader"
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
                <Text style={styles.dangerButtonText}>End group & disband</Text>
              </TouchableOpacity>
            </>
          )}
          {!group.isLeader && group.isMember && ["RECRUITING", "READY"].includes(group.state) && (
            <TouchableOpacity style={styles.dangerButtonSmall} onPress={() => leaveMutation.mutate(undefined as never)}>
              <Text style={styles.dangerButtonText}>Leave group</Text>
            </TouchableOpacity>
          )}
          {group.state === "DISBANDED" && <Text style={styles.hint}>This group has ended.</Text>}
        </View>
        {group.isLeader && group.state !== "READY" && ["RECRUITING", "READY"].includes(group.state) && (
          <Text style={styles.hint}>Start Work unlocks once at least {group.sizeMin} members have an approved task.</Text>
        )}
      </Section>
    </ScrollView>
  );
}

// 7.10 - previous members of this group are easy to invite back before recruiting strangers.
function PreviousMembersQuickInvite({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const { data: previousMembers } = useQuery({ queryKey: ["previous-members", groupId], queryFn: () => getPreviousMembers(groupId) });

  const inviteMutation = useMutation({
    mutationFn: (userId: string) => inviteMember(groupId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["previous-members", groupId] }),
  });

  if (!previousMembers || previousMembers.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.hint}>Previous members of this group:</Text>
      <View style={styles.actionRow}>
        {previousMembers.map((m) => (
          <TouchableOpacity key={m.userId} style={styles.secondaryButtonSmall} onPress={() => inviteMutation.mutate(m.userId)}>
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
  description: { fontSize: 14, color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  banner: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, marginTop: spacing.md },
  bannerText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
  memberTask: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
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
