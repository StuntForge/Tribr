import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  getMyApplications,
  getMyInvitations,
  MyApplication,
  MyInvitation,
  respondToInvitation,
  withdrawApplication,
} from "../../api/groups";
import { jobLengthLabelShort } from "../../constants/jobLength";
import ProBadge from "../../components/ProBadge";
import SegmentedTabs from "../../components/SegmentedTabs";
import SortSelect from "../../components/SortSelect";
import { useToast } from "../../components/Toast";
import { colors, radii, shadows, spacing } from "../../theme";

type SortKey = "distance" | "members";
type Tab = "invitations" | "applications";

const APPLICATION_STATUS_LABEL: Record<MyApplication["status"], string> = {
  PENDING: "Waiting on the leader",
  TASK_REQUESTED: "Leader asked for a different task",
  TASK_SUGGESTED: "Leader suggested a different task",
};

export default function MyInvitationsScreen({ route, navigation }: any) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(route?.params?.initialTab === "applications" ? "applications" : "invitations");
  const [sort, setSort] = useState<SortKey>("distance");

  const { data: invitations, isLoading: invitationsLoading } = useQuery({ queryKey: ["my-invitations"], queryFn: getMyInvitations });
  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ["my-applications"],
    queryFn: getMyApplications,
  });

  const sortedInvitations = useMemo(() => {
    if (!invitations) return invitations;
    const copy = [...invitations];
    if (sort === "distance") {
      copy.sort((a, b) => (a.group.approxDistanceMiles ?? Infinity) - (b.group.approxDistanceMiles ?? Infinity));
    } else {
      copy.sort((a, b) => b.group.memberCount - a.group.memberCount);
    }
    return copy;
  }, [invitations, sort]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
    queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    queryClient.invalidateQueries({ queryKey: ["my-groups"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["action-items"] });
  };

  const respondMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondToInvitation(id, accept),
    onSuccess: (_data, variables) => {
      invalidate();
      const groupId = invitations?.find((i) => i.id === variables.id)?.group.id;
      if (variables.accept && groupId) navigation.navigate("GroupDetail", { groupId });
    },
    onError: (e: any) => toast.show(e?.message ?? "Something went wrong - please try again."),
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ groupId, appId }: { groupId: string; appId: string }) => withdrawApplication(groupId, appId),
    onSuccess: invalidate,
    onError: (e: any) => toast.show(e?.message ?? "Couldn't withdraw the application - please try again."),
  });

  const confirmWithdraw = (application: MyApplication) => {
    Alert.alert(
      "Withdraw application?",
      `This frees up "${application.task.name}" so you can submit it elsewhere.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: () => withdrawMutation.mutate({ groupId: application.groupId, appId: application.id }),
        },
      ]
    );
  };

  const invitationCount = invitations?.length ?? 0;
  const applicationCount = applications?.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <SegmentedTabs
          options={[
            { value: "invitations", label: `Invitations${invitationCount > 0 ? ` (${invitationCount})` : ""}`, icon: "mail-open" },
            { value: "applications", label: `Applications${applicationCount > 0 ? ` (${applicationCount})` : ""}`, icon: "paper-plane" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === "invitations" ? (
        invitationsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            style={styles.container}
            contentContainerStyle={styles.listContent}
            data={sortedInvitations}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={
              invitationCount > 0 ? (
                <View style={{ marginBottom: spacing.md }}>
                  <SortSelect
                    options={[
                      { value: "distance", label: "Distance" },
                      { value: "members", label: "Total members" },
                    ]}
                    value={sort}
                    onChange={setSort}
                  />
                </View>
              ) : null
            }
            ListEmptyComponent={<Text style={styles.emptyBody}>No pending invitations.</Text>}
            renderItem={({ item }) => (
              <InvitationCard
                invitation={item}
                busy={respondMutation.isPending}
                pendingAccept={respondMutation.isPending && respondMutation.variables?.id === item.id && respondMutation.variables.accept}
                pendingDecline={respondMutation.isPending && respondMutation.variables?.id === item.id && !respondMutation.variables.accept}
                onAccept={() => respondMutation.mutate({ id: item.id, accept: true })}
                onDecline={() => respondMutation.mutate({ id: item.id, accept: false })}
                onViewTasks={() => navigation.navigate("GroupCurrentTasks", { groupId: item.group.id, groupName: item.group.name })}
              />
            )}
          />
        )
      ) : applicationsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.listContent}
          data={applications}
          keyExtractor={(a) => a.id}
          ListEmptyComponent={<Text style={styles.emptyBody}>No open applications.</Text>}
          renderItem={({ item }) => (
            <ApplicationCard
              application={item}
              busy={withdrawMutation.isPending && withdrawMutation.variables?.appId === item.id}
              onViewGroup={() => navigation.navigate("GroupDetail", { groupId: item.groupId })}
              onWithdraw={() => confirmWithdraw(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function InvitationCard({
  invitation,
  busy,
  pendingAccept,
  pendingDecline,
  onAccept,
  onDecline,
  onViewTasks,
}: {
  invitation: MyInvitation;
  busy: boolean;
  pendingAccept: boolean;
  pendingDecline: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onViewTasks: () => void;
}) {
  const { group } = invitation;

  const ageRange =
    group.preferredAgeMin != null || group.preferredAgeMax != null
      ? `${group.preferredAgeMin ?? "Any"}-${group.preferredAgeMax ?? "Any"}`
      : "Any age";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.approxDistanceMiles != null && <Text style={styles.distance}>{group.approxDistanceMiles} mi away</Text>}
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>led by {group.leaderName}</Text>
        {group.leaderIsPro && <ProBadge size="tiny" />}
      </View>

      <View style={styles.detailGrid}>
        <DetailRow icon="people" label={`${group.memberCount} member${group.memberCount === 1 ? "" : "s"} (${group.sizeMin}-${group.sizeMax})`} />
        {group.preferredGender && <DetailRow icon="body" label={group.preferredGender} />}
        <DetailRow icon="calendar" label={`Age: ${ageRange}`} />
        {group.minRating != null && <DetailRow icon="star" label={`${group.minRating.toFixed(1)}★ minimum rating`} />}
        {group.verifiedOnly && <DetailRow icon="checkmark-circle" label="Verified members only" />}
        <DetailRow icon="pricetags" label={group.categories.length > 0 ? group.categories.join(", ") : "Any category"} />
      </View>

      {invitation.suggestedTask && (
        <Text style={styles.taskLine}>You'd join with: {invitation.suggestedTask.name}</Text>
      )}

      <TouchableOpacity style={styles.viewTasksButton} onPress={onViewTasks}>
        <Ionicons name="list" size={14} color={colors.primary} />
        <Text style={styles.viewTasksButtonText}>View Details</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.primaryButton, busy && styles.buttonDisabled]} onPress={onAccept} disabled={busy}>
          {pendingAccept ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Accept</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, busy && styles.buttonDisabled]} onPress={onDecline} disabled={busy}>
          {pendingDecline ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.secondaryButtonText}>Decline</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ApplicationCard({
  application,
  busy,
  onViewGroup,
  onWithdraw,
}: {
  application: MyApplication;
  busy: boolean;
  onViewGroup: () => void;
  onWithdraw: () => void;
}) {
  const needsAttention = application.status !== "PENDING";
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.groupName}>{application.groupName}</Text>
        <View style={[styles.statusPill, needsAttention && styles.statusPillAlert]}>
          <Text style={[styles.statusPillText, needsAttention && styles.statusPillTextAlert]}>
            {APPLICATION_STATUS_LABEL[application.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.taskLine}>
        {application.task.name} · {application.task.category} · {jobLengthLabelShort(application.task.jobLength)}
      </Text>
      {application.rejectionReason && <Text style={styles.reasonText}>"{application.rejectionReason}"</Text>}

      <TouchableOpacity style={styles.viewTasksButton} onPress={onViewGroup}>
        <Ionicons name="people" size={14} color={colors.primary} />
        <Text style={styles.viewTasksButtonText}>View Tribe</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.withdrawButton, busy && styles.buttonDisabled]} onPress={onWithdraw} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.withdrawButtonText}>Withdraw application</Text>}
      </TouchableOpacity>
    </View>
  );
}

function DetailRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.detailText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.card },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  groupName: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  distance: { fontSize: 12, fontWeight: "600", color: colors.primary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textMuted },
  detailGrid: { marginTop: spacing.sm, gap: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12, color: colors.text },
  taskLine: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: spacing.sm },
  reasonText: { fontSize: 12, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
  statusPill: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusPillAlert: { backgroundColor: colors.dangerLight },
  statusPillText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  statusPillTextAlert: { color: colors.danger },
  viewTasksButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  viewTasksButtonText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  withdrawButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  withdrawButtonText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  secondaryButtonText: { color: colors.danger, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
});
