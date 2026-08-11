import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getMyInvitations, MyInvitation, respondToInvitation } from "../../api/groups";
import ProBadge from "../../components/ProBadge";
import SortSelect from "../../components/SortSelect";
import { colors, radii, shadows, spacing } from "../../theme";

type SortKey = "distance" | "members";

export default function MyInvitationsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { data: invitations, isLoading } = useQuery({ queryKey: ["my-invitations"], queryFn: getMyInvitations });
  const [sort, setSort] = useState<SortKey>("distance");

  const sorted = useMemo(() => {
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
    queryClient.invalidateQueries({ queryKey: ["my-groups"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const respondMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondToInvitation(id, accept),
    onSuccess: (_data, variables) => {
      invalidate();
      const groupId = invitations?.find((i) => i.id === variables.id)?.group.id;
      if (variables.accept && groupId) navigation.navigate("GroupDetail", { groupId });
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
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={sorted}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={
        (invitations?.length ?? 0) > 0 ? (
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
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
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 10, padding: spacing.sm, alignItems: "center" },
  secondaryButtonText: { color: colors.danger, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
});
