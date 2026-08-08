import React from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getMyGroups, getMyInvitations, GroupState } from "../../api/groups";
import { useAuth } from "../../context/AuthContext";
import { useUnreadMessages } from "../../hooks/useUnreadMessages";
import { colors, radii, shadows, spacing } from "../../theme";

const STATE_LABEL: Record<GroupState, string> = {
  RECRUITING: "Recruiting",
  READY: "Ready to start",
  WORKING: "Working",
  COMPLETED: "Cycle complete",
  DISSOLUTION: "Dissolution vote",
  DISBANDED: "Disbanded",
};

// Matches the backend's FREE_GROUP_LIMIT / SUBSCRIBER_GROUP_LIMIT (groups.ts).
const FREE_GROUP_LIMIT = 1;
const SUBSCRIBER_GROUP_LIMIT = 6;

export default function GroupsHomeScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["my-groups"], queryFn: getMyGroups });
  const { data: invitations } = useQuery({ queryKey: ["my-invitations"], queryFn: getMyInvitations });
  const { data: unreadMessages } = useUnreadMessages();
  const unreadGroupIds = new Set(unreadMessages?.map((u) => u.groupId));

  const limit = profile?.subscriptionTier === "SUBSCRIBER" ? SUBSCRIBER_GROUP_LIMIT : FREE_GROUP_LIMIT;
  const activeCount = groups?.length ?? 0;
  const atLimit = activeCount >= limit;
  const invitationCount = invitations?.length ?? 0;

  const explainLimit = () =>
    Alert.alert(
      "You're at your group limit",
      `You're already in ${activeCount} of ${limit} group${limit === 1 ? "" : "s"} your plan allows. Leave or finish one before joining or creating another.`
    );

  return (
    <View style={styles.container}>
      <View style={styles.menuRow}>
        <MenuButton
          icon="search"
          label="Find a group"
          disabled={atLimit}
          onPress={() => (atLimit ? explainLimit() : navigation.navigate("BrowseGroups"))}
        />
        <MenuButton
          icon="mail-open"
          label="Invitations"
          badge={invitationCount > 0 ? invitationCount : undefined}
          onPress={() => navigation.navigate("MyInvitations")}
        />
        <MenuButton
          icon="add-circle"
          label="Create a group"
          disabled={atLimit}
          onPress={() =>
            atLimit
              ? explainLimit()
              : profile?.subscriptionTier === "SUBSCRIBER"
                ? navigation.navigate("CreateGroup")
                : navigation.navigate("CreateGroup", { blocked: true })
          }
        />
      </View>
      {atLimit && (
        <Text style={styles.limitNote}>
          You're at your plan's group limit ({activeCount}/{limit}) - Find a group and Create a group are turned off until you leave or finish one.
        </Text>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>You're not in a group yet</Text>
              <Text style={styles.emptyBody}>
                Tap "Find a group" above to apply with one of your tasks, or create your own group if you're a
                Subscriber.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>
                  {item.name} {item.isLeader ? "👑" : ""}
                </Text>
                {unreadGroupIds.has(item.id) && (
                  <View style={styles.unreadPill}>
                    <Ionicons name="chatbubble" size={11} color="#fff" />
                    <Text style={styles.unreadPillText}>New</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardMeta}>
                {STATE_LABEL[item.state]} · Cycle {item.currentCycleNumber}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function MenuButton({
  icon,
  label,
  onPress,
  disabled,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <TouchableOpacity style={[styles.menuButton, disabled && styles.menuButtonDisabled]} onPress={onPress}>
      <View>
        <Ionicons name={icon} size={22} color={disabled ? colors.textMuted : "#fff"} />
        {badge != null && (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.menuButtonText, disabled && styles.menuButtonTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  menuRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  menuButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 6,
    ...shadows.raised,
  },
  menuButtonDisabled: { backgroundColor: colors.border, ...shadows.card },
  menuButtonText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
  menuButtonTextDisabled: { color: colors.textMuted },
  menuBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  menuBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  limitNote: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    lineHeight: 17,
  },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
  unreadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  unreadPillText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
