import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyToGroup,
  castDissolutionBallot,
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
import { getActionItems } from "../../api/notifications";
import { useAuth } from "../../context/AuthContext";
import TaskSelectRow from "../../components/TaskSelectRow";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { useToast } from "../../components/Toast";
import { categoryThumbnail } from "../../constants/categoryThumbnails";
import { socialCategoryIcon } from "../../constants/socialCategoryIcons";
import { openInMaps } from "../../utils/openInMaps";
import { colors, radii, shadows, spacing, type } from "../../theme";

function formatSocialEventDate(date: string, allDay: boolean, startTime: string | null): string {
  const d = new Date(date);
  const dateLabel = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  if (allDay || !startTime) return dateLabel;
  const [h, m] = startTime.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${dateLabel}, ${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

const STATE_LABEL: Record<string, string> = {
  RECRUITING: "RECRUITING",
  READY: "READY",
  WORKING: "ACTIVE",
  COMPLETED: "COMPLETED",
  DISSOLUTION: "DISSOLUTION",
  DISBANDED: "DISBANDED",
};

export default function GroupDetailScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string };
  const { profile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);

  // Polls while this screen is open (not just on mount) and refetches on
  // focus, so a member joining/leaving or the Tribe disbanding shows up
  // live instead of needing to navigate away and back.
  const { data: group, isLoading, refetch: refetchGroup } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId),
    refetchInterval: 8000,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetchGroup();
    }, [refetchGroup])
  );
  const { data: actionItems } = useQuery({ queryKey: ["action-items"], queryFn: getActionItems });
  const myActionItems = (actionItems ?? []).filter((a) => a.groupId === groupId);
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

  const applyMutation = useMutation({
    mutationFn: (taskId: string | undefined) => applyToGroup(groupId, taskId, message.trim() || undefined),
    onSuccess: () => {
      invalidate();
      toast.show("Application submitted");
      navigation.navigate("GroupsHome");
    },
    onError: (e: any) => setError(e.message ?? "Something went wrong."),
  });
  const leaveMutation = useAction(() => leaveGroup(groupId));
  // Disband navigates away immediately on confirm (see confirmDisband) rather
  // than waiting for the request, so its own error can't show inline on a
  // screen the user has already left - a toast is the only way to surface it.
  const disbandMutation = useMutation({
    mutationFn: () => disbandGroup(groupId),
    onSuccess: invalidate,
    onError: () => toast.show("Couldn't disband the Tribe - please try again."),
  });
  const startWorkMutation = useAction(() => startWork(groupId));
  const deferMutation = useAction((taskId: string) => deferTask(groupId, taskId));
  const forgoMutation = useAction((taskId: string) => forgoTask(groupId, taskId));
  const requestDissolutionMutation = useAction(() => requestDissolution(groupId));
  const ballotMutation = useAction((choice: "YES" | "NO") => castDissolutionBallot(groupId, group!.dissolutionVote!.id, choice));
  const removeMemberMutation = useAction((userId: string) => removeMember(groupId, userId));

  // A single shared busy flag across every group action - each button
  // dims and stops responding to taps the instant any one of them fires,
  // instead of sitting there looking clickable for the ~1-2s round trip.
  const busy =
    applyMutation.isPending ||
    leaveMutation.isPending ||
    disbandMutation.isPending ||
    startWorkMutation.isPending ||
    deferMutation.isPending ||
    forgoMutation.isPending ||
    requestDissolutionMutation.isPending ||
    ballotMutation.isPending ||
    removeMemberMutation.isPending;

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

  // A stale notification, a left-open tab, or the last member's leave can
  // all land here after the viewer is no longer part of this Tribe (or it's
  // been disbanded outright). RECRUITING/READY stay viewable since that's
  // the normal "browsing before joining" path.
  const noLongerAccessible =
    !group.isMember && !group.isLeader && !["RECRUITING", "READY"].includes(group.state);
  if (noLongerAccessible) {
    return (
      <View style={styles.center}>
        <Ionicons name="people-outline" size={40} color={colors.textMuted} />
        <Text style={styles.noLongerInTribeTitle}>No longer in Tribe</Text>
        <Text style={styles.noLongerInTribeBody}>
          {group.state === "DISBANDED" ? "This Tribe has been disbanded." : "You're not a member of this Tribe anymore."}
        </Text>
        <TouchableOpacity style={styles.primaryButtonFull} onPress={() => navigation.navigate("GroupsHome")}>
          <Text style={styles.primaryButtonFullText}>Back to Tribes</Text>
        </TouchableOpacity>
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
      {
        text: "Disband",
        style: "destructive",
        onPress: () => {
          navigation.navigate("GroupsHome");
          disbandMutation.mutate(undefined as never);
        },
      },
    ]);
  };

  const confirmLeave = () => {
    Alert.alert("Leave this Tribe?", "You can rejoin later if it's still recruiting.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => leaveMutation.mutate(undefined as never) },
    ]);
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
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          {group.tribeType === "SOCIAL" ? (
            <View style={[styles.heroPhoto, styles.heroPhotoFallback]}>
              <Ionicons name={socialCategoryIcon(group.socialCategory)} size={28} color={colors.primary} />
            </View>
          ) : group.leaderTaskPhotoUrl ? (
            <Image source={{ uri: group.leaderTaskPhotoUrl }} style={styles.heroPhoto} />
          ) : categoryThumbnail(group.leaderTaskCategory) ? (
            <View style={[styles.heroPhoto, styles.heroPhotoFallback]}>
              <Image source={categoryThumbnail(group.leaderTaskCategory)} style={styles.heroCategoryImage} resizeMode="contain" />
            </View>
          ) : (
            <View style={[styles.heroPhoto, styles.heroPhotoFallback]}>
              <Ionicons name="people" size={28} color={colors.primary} />
            </View>
          )}
          <View style={styles.heroTextCol}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle}>{group.name}</Text>
              <StatePill state={group.state} />
            </View>
            {group.tribeType === "SOCIAL" ? (
              <Text style={styles.heroMeta}>
                {group.socialCategory ?? "Social"} · {group.memberCount}/{group.sizeMax} members
              </Text>
            ) : (
              <Text style={styles.heroMeta}>
                {group.categories.length > 0 ? group.categories.map((c) => c.name).join(", ") : "Any category"} ·{" "}
                {group.memberCount}/{group.sizeMax} members · Cycle {group.currentCycleNumber}
                {group.averageMemberRating != null ? ` · ★ ${group.averageMemberRating.toFixed(1)}` : ""}
              </Text>
            )}
            {group.tribeType === "SOCIAL" && (
              <Text style={styles.requirementMeta}>
                {group.socialEvent
                  ? formatSocialEventDate(group.socialEvent.confirmedDate, group.socialEvent.allDay, group.socialEvent.startTime)
                  : group.dateType === "FIXED" && group.fixedDate
                  ? formatSocialEventDate(group.fixedDate, group.fixedAllDay ?? true, group.fixedStartTime)
                  : "Date: To be arranged"}
              </Text>
            )}
            {/* Shown to prospective (non-member) applicants too, same as the
                date above - both are what someone needs to decide whether to
                apply, not member-only information. Tappable straight to the
                phone's own Maps app for directions - no lookup needed, we
                already have the coordinates. */}
            {group.tribeType === "SOCIAL" && group.locationLabel && (
              <TouchableOpacity
                onPress={() => group.locationLat != null && group.locationLng != null && openInMaps(group.locationLat, group.locationLng)}
                disabled={group.locationLat == null || group.locationLng == null}
              >
                <View style={styles.locationLinkRow}>
                  <Text style={styles.requirementMeta}>{group.locationLabel}</Text>
                  {group.locationLat != null && group.locationLng != null && (
                    <Ionicons name="open-outline" size={13} color={colors.primary} />
                  )}
                </View>
              </TouchableOpacity>
            )}
            {(group.verifiedOnly || group.minRating != null || group.preferredGender || group.preferredAgeMin != null || group.preferredAgeMax != null) && (
              <Text style={styles.requirementMeta}>
                Requires:{" "}
                {[
                  group.verifiedOnly ? "Verified members" : null,
                  group.minRating != null ? `${group.minRating.toFixed(1)}★ minimum rating` : null,
                  group.preferredGender ? `${group.preferredGender} only` : null,
                  group.preferredAgeMin != null || group.preferredAgeMax != null
                    ? `Age ${group.preferredAgeMin ?? "Any"}-${group.preferredAgeMax ?? "Any"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.heroDescription}>{group.description}</Text>
      </View>

      {group.tribeType === "SOCIAL" &&
        (group.isMember || group.isLeader) &&
        group.state === "WORKING" &&
        (group.dateType === "SCHEDULE_TOGETHER" || (group.socialEvent && new Date(group.socialEvent.confirmedDate) <= new Date())) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Event details</Text>
          {group.state === "WORKING" && group.dateType === "SCHEDULE_TOGETHER" && !group.socialEvent && (
            <TouchableOpacity
              style={styles.primaryButtonFull}
              onPress={() => navigation.navigate("SocialSchedule", { groupId, groupName: group.name })}
            >
              <Ionicons name="calendar" size={16} color="#fff" />
              <Text style={styles.primaryButtonFullText}>
                {group.isLeader ? "Manage scheduling" : "Submit your availability"}
              </Text>
            </TouchableOpacity>
          )}
          {group.isLeader && group.state === "WORKING" && group.socialEvent && new Date(group.socialEvent.confirmedDate) <= new Date() && (
            <TouchableOpacity
              style={styles.primaryButtonFull}
              onPress={() => navigation.navigate("SocialAttendance", { groupId, groupName: group.name })}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.primaryButtonFullText}>Record attendance</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {(group.isMember || group.isLeader) && (
        <ActionRow
          icon="chatbubble-ellipses"
          title="Tribe chat"
          subtitle="Chat with your Tribe"
          onPress={() => navigation.navigate("GroupChat", { groupId })}
        />
      )}

      {group.isLeader && (group.pendingApplicationCount ?? 0) > 0 && (
        <TouchableOpacity style={styles.banner} onPress={() => navigation.navigate("Applications", { groupId })}>
          <Text style={styles.bannerText}>Review {group.pendingApplicationCount} pending application(s) →</Text>
        </TouchableOpacity>
      )}

      {group.isLeader && ["RECRUITING", "READY"].includes(group.state) && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconBadge}>
              <Ionicons name="person-add" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>Recruit members</Text>
              <Text style={styles.cardHeaderSubtitle}>Find great people to join your Tribe.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryButtonFull}
            onPress={() => navigation.navigate("SearchMembers", { groupIdToInviteTo: groupId })}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.primaryButtonFullText}>Find & invite members</Text>
          </TouchableOpacity>
          <PreviousMembersQuickInvite groupId={groupId} navigation={navigation} />
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Members ({group.memberCount}/{group.sizeMax})
          </Text>
          {canManageMembers && (
            <TouchableOpacity style={styles.managePill} onPress={() => setManageMode((v) => !v)}>
              <Ionicons name="settings" size={13} color={colors.primary} />
              <Text style={styles.managePillText}>Manage</Text>
            </TouchableOpacity>
          )}
        </View>

        {openKickVotes.map((v) => (
          <TouchableOpacity key={v.id} style={styles.banner} onPress={() => navigation.navigate("KickVote", { voteId: v.id })}>
            <Text style={styles.bannerText}>Vote in progress to remove {v.target.firstName} →</Text>
          </TouchableOpacity>
        ))}

        {group.members.map((m, idx) => {
          const isSelf = m.userId === profile?.id;
          const showRemove = canManageMembers && manageMode && !m.isLeader && !isSelf;
          const showVoteKick =
            canVoteKick && !m.isLeader && !isSelf && !openKickVotes.some((v) => v.target.id === m.userId);
          const isUpNext = !!m.currentTask && group.queue.find((q) => q.taskId === m.currentTask!.id)?.isActive;
          const isLast = idx === group.members.length - 1;

          return (
            <View key={m.userId} style={[styles.memberRow, !isLast && styles.memberRowDivider]}>
              <TouchableOpacity
                style={styles.memberIdentity}
                onPress={() => navigation.navigate("PublicProfile", { userId: m.userId })}
                disabled={isSelf}
              >
                <Avatar name={m.firstName} photoUrl={m.photoUrl} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.firstName}
                    </Text>
                    {m.isLeader && <Ionicons name="ribbon" size={14} color={colors.star} />}
                    {isSelf && (
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>YOU</Text>
                      </View>
                    )}
                    {m.rating != null && (
                      <View style={styles.memberRatingPill}>
                        <Ionicons name="star" size={11} color={colors.star} />
                        <Text style={styles.memberRatingText}>{m.rating.toFixed(1)}</Text>
                      </View>
                    )}
                    {m.isPro && <ProBadge size="tiny" />}
                  </View>
                  {group.tribeType === "WORK" && (
                    <Text style={styles.memberSubtitle} numberOfLines={1}>
                      {m.currentTask ? m.currentTask.name : "No task this cycle"}
                    </Text>
                  )}
                </View>
                {!isSelf && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
              </TouchableOpacity>

              <View style={styles.memberBottomRow}>
                {isSelf && isUpNext ? (
                  <View style={styles.upNextPill}>
                    <Text style={styles.upNextPillText}>Up next</Text>
                  </View>
                ) : !isSelf && m.currentTask ? (
                  <TouchableOpacity
                    style={styles.viewTaskLink}
                    onPress={() => navigation.navigate("TaskDetail", { taskId: m.currentTask!.id })}
                  >
                    <Text style={styles.viewTaskLinkText}>View task</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                  </TouchableOpacity>
                ) : (
                  <View />
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

        {["RECRUITING", "READY"].includes(group.state) && group.memberCount < group.sizeMin && (
          <View style={styles.infoBox}>
            <Ionicons name="people" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBoxTitle}>
                Invite {group.sizeMin - group.memberCount} more member{group.sizeMin - group.memberCount === 1 ? "" : "s"} to
                start your Tribe.
              </Text>
              <Text style={styles.infoBoxBody}>Start your Tribe when you have the right number of members.</Text>
            </View>
          </View>
        )}
      </View>

      {group.tribeType === "WORK" && group.progress && group.progress.total > 0 && (group.state === "WORKING" || group.state === "COMPLETED") && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Cycle progress</Text>
            <Text style={styles.cycleLabel}>Cycle {group.currentCycleNumber}</Text>
          </View>
          <View style={styles.progressBarTrack}>
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
        </View>
      )}

      {group.tribeType === "WORK" && group.state === "WORKING" && group.queue.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Task order</Text>
          {group.queue.map((q, i) => (
            <View key={q.taskId} style={[styles.queueRow, q.isActive && styles.queueRowActive]}>
              <Text style={styles.queuePosition}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.queueTaskName} numberOfLines={1}>
                  {q.taskName} — {q.ownerName}
                </Text>
                <View style={styles.queueStatusRow}>
                  {q.isActive && (
                    <View style={styles.upNextPill}>
                      <Text style={styles.upNextPillText}>Up next</Text>
                    </View>
                  )}
                  <Text style={styles.queueStatusText}>
                    {q.isActive ? (q.workDayConfirmed ? "In progress - work day confirmed" : "Active now") : q.status}
                  </Text>
                </View>
              </View>
              {q.isActive && !q.workDayConfirmed && (
                <TouchableOpacity
                  style={styles.secondaryButtonSmall}
                  onPress={() => navigation.navigate("TaskSchedule", { groupId, taskId: q.taskId, taskName: q.taskName })}
                >
                  <Text style={styles.secondaryButtonText}>Schedule</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {group.tribeType === "WORK" && myActiveQueueTask && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your task is active</Text>
          {!myActiveQueueTask.workDayConfirmed && (
            <Text style={styles.hint}>Confirm a work date before you can mark this task complete.</Text>
          )}
          <View style={styles.actionRow}>
            {myActiveQueueTask.workDayConfirmed && (
              <TouchableOpacity
                style={styles.primaryButtonSmall}
                onPress={() =>
                  navigation.navigate("CompleteTask", { groupId, taskId: myActiveQueueTask.taskId, taskName: myActiveQueueTask.taskName })
                }
              >
                <Text style={styles.primaryButtonText}>Mark complete</Text>
              </TouchableOpacity>
            )}
            {group.queue.length > 1 && (
              <TouchableOpacity
                style={[styles.secondaryButtonSmall, busy && styles.buttonDisabled]}
                onPress={() => deferMutation.mutate(myActiveQueueTask.taskId)}
                disabled={busy}
              >
                {deferMutation.isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Defer</Text>}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.secondaryButtonSmall, busy && styles.buttonDisabled]}
              onPress={() => forgoMutation.mutate(myActiveQueueTask.taskId)}
              disabled={busy}
            >
              {forgoMutation.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Forgo this cycle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {canApply && group.tribeType === "SOCIAL" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Apply to join</Text>
          <Text style={styles.hint}>Ask to join this Tribe's activity - no task needed.</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Optional message to the Tribe leader"
          />
          <TouchableOpacity
            style={[styles.primaryButtonFull, busy && styles.buttonDisabled]}
            onPress={() => applyMutation.mutate(undefined)}
            disabled={busy}
          >
            {applyMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonFullText}>Apply</Text>}
          </TouchableOpacity>
        </View>
      )}

      {canApply && group.tribeType === "WORK" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Apply to join</Text>
          {availableTasks.length === 0 ? (
            <Text style={styles.hint}>Add an available task from your Task Library first.</Text>
          ) : (
            <>
              {availableTasks.map((t) => {
                const declined = group.declinedTaskIds.includes(t.id);
                return (
                  <TaskSelectRow
                    key={t.id}
                    task={t}
                    selected={selectedTaskId === t.id}
                    onSelect={() => !declined && setSelectedTaskId(t.id)}
                    navigation={navigation}
                    disabled={declined}
                    disabledReason="Recently declined for this Tribe - choose a different task."
                  />
                );
              })}
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Optional message to the Tribe leader"
              />
              <TouchableOpacity
                style={[styles.primaryButtonFull, (!selectedTaskId || busy) && styles.buttonDisabled]}
                onPress={() => selectedTaskId && applyMutation.mutate(selectedTaskId)}
                disabled={!selectedTaskId || busy}
              >
                {applyMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonFullText}>Apply</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {group.state === "WORKING" && (
        <>
          {group.dissolutionVote ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Dissolution</Text>
              <Text style={styles.hint}>
                A member requested dissolution. Voting closes {new Date(group.dissolutionVote.endsAt).toLocaleString()}.
                Not voting counts as Yes.
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.secondaryButtonSmall, busy && styles.buttonDisabled]}
                  onPress={() => ballotMutation.mutate("YES")}
                  disabled={busy}
                >
                  <Text style={styles.secondaryButtonText}>Vote Yes, dissolve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButtonSmall, busy && styles.buttonDisabled]}
                  onPress={() => ballotMutation.mutate("NO")}
                  disabled={busy}
                >
                  <Text style={styles.secondaryButtonText}>Vote No, keep going</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            (group.isMember || group.isLeader) && (
              <ActionRow
                icon="warning"
                iconColor={colors.danger}
                title="Request dissolution"
                titleColor={colors.danger}
                onPress={() => (busy ? undefined : requestDissolutionMutation.mutate(undefined as never))}
              />
            )
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Actions</Text>
        {group.isLeader && group.state !== "READY" && ["RECRUITING", "READY"].includes(group.state) && (
          <Text style={styles.hint}>
            {group.tribeType === "SOCIAL"
              ? `Start Tribe unlocks once you have at least ${group.sizeMin} members.`
              : `Start Work unlocks once at least ${group.sizeMin} members have an approved task.`}
          </Text>
        )}
        <View style={styles.actionColumn}>
          {myActionItems
            .filter((item) => item.type === "RATE_HOST")
            .map((item) => (
              <ActionRow
                key={item.id}
                icon="star"
                title="Rate the host"
                subtitle={item.taskName ? `"${item.taskName}"` : undefined}
                onPress={() => navigation.navigate("RateHost", { groupId, taskId: item.taskId, taskName: item.taskName })}
              />
            ))}
          {group.isLeader && ["RECRUITING", "READY"].includes(group.state) && (
            <>
              <TouchableOpacity
                style={[styles.primaryButtonFull, (group.state !== "READY" || busy) && styles.buttonDisabled]}
                onPress={() => !startWorkMutation.isPending && startWorkMutation.mutate(undefined as never)}
                disabled={group.state !== "READY" || busy}
              >
                {startWorkMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.primaryButtonFullText}>Start Tribe</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerButtonFull, busy && styles.buttonDisabled]} onPress={confirmDisband} disabled={busy}>
                <Ionicons name="trash" size={16} color={colors.danger} />
                <Text style={styles.dangerButtonFullText}>Disband Tribe</Text>
              </TouchableOpacity>
            </>
          )}
          {(group.isMember || group.isLeader) && group.state === "COMPLETED" && (
            <TouchableOpacity
              style={styles.primaryButtonFull}
              onPress={() => navigation.navigate("CompleteTribe", { groupId, groupName: group.name })}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.primaryButtonFullText}>
                {group.tribeType === "SOCIAL" ? "All done - leave the Tribe" : "Work's done - leave the Tribe"}
              </Text>
            </TouchableOpacity>
          )}
          {!group.isLeader && group.isMember && ["RECRUITING", "READY"].includes(group.state) && (
            <TouchableOpacity style={[styles.dangerButtonFull, busy && styles.buttonDisabled]} onPress={confirmLeave} disabled={busy}>
              <Text style={styles.dangerButtonFullText}>Leave Tribe</Text>
            </TouchableOpacity>
          )}
          {group.state === "DISBANDED" && <Text style={styles.hint}>This Tribe has ended.</Text>}
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

function StatePill({ state }: { state: string }) {
  const isActive = state === "WORKING";
  return (
    <View style={[styles.statePill, isActive && styles.statePillFilled]}>
      {isActive && <Ionicons name="play" size={10} color="#fff" />}
      <Text style={[styles.statePillText, isActive && styles.statePillTextFilled]}>{STATE_LABEL[state] ?? state}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  iconColor = colors.primary,
  title,
  titleColor = colors.text,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionRowCard} onPress={onPress}>
      <View style={[styles.iconBadge, iconColor !== colors.primary && { backgroundColor: colors.dangerLight }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardHeaderTitle, { color: titleColor }]}>{title}</Text>
        {subtitle && <Text style={styles.cardHeaderSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl, gap: spacing.sm },
  noLongerInTribeTitle: { ...type.h3, textAlign: "center" },
  noLongerInTribeBody: { ...type.caption, textAlign: "center", marginBottom: spacing.md },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    position: "relative",
    ...shadows.card,
  },
  heroCategoryImage: { width: 64, height: 64 },
  heroTopRow: { flexDirection: "row", gap: spacing.md },
  heroPhoto: { width: 92, height: 92, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  heroPhotoFallback: { alignItems: "center", justifyContent: "center" },
  heroTextCol: { flex: 1, gap: 2 },
  heroTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  heroTitle: { ...type.h2, flex: 1 },
  heroMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  requirementMeta: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 2 },
  locationLinkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroDescription: { fontSize: 14, color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  eventDetailRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  eventDetailText: { fontSize: 13, color: colors.text },

  statePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statePillFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  statePillText: { fontSize: 10, fontWeight: "800", color: colors.primary, letterSpacing: 0.3 },
  statePillTextFilled: { color: "#fff" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  actionRowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  cardHeaderTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardHeaderSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  cycleLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted },

  managePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  managePillText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  banner: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  bannerText: { color: "#fff", fontWeight: "600", textAlign: "center" },

  memberRow: { paddingVertical: spacing.sm, gap: spacing.xs },
  memberRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  memberIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  memberName: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
  memberSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  youPill: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 1 },
  youPillText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  memberRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  memberRatingText: { fontSize: 11, fontWeight: "700", color: colors.text },
  memberBottomRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: 48 },
  memberActionText: { fontSize: 12, fontWeight: "600", color: colors.danger },
  upNextPill: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  upNextPillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  viewTaskLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewTaskLinkText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  infoBoxTitle: { fontSize: 13, fontWeight: "700", color: colors.text, lineHeight: 18 },
  infoBoxBody: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },

  progressBarTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden", marginBottom: spacing.xs },
  progressBarFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 5 },

  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  queueRowActive: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: spacing.sm },
  queuePosition: { fontSize: 14, fontWeight: "700", color: colors.textMuted, width: 20 },
  queueTaskName: { fontSize: 14, fontWeight: "700", color: colors.text },
  queueStatusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  queueStatusText: { fontSize: 12, color: colors.textMuted },

  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, marginBottom: spacing.md, textAlign: "center" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionColumn: { gap: spacing.sm },
  primaryButtonSmall: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  primaryButtonFull: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonFullText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryButtonSmall: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  dangerButtonFull: {
    flexDirection: "row",
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonFullText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
  buttonDisabled: { opacity: 0.4 },
});
