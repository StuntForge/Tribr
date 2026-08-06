import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getMyGroups, GroupState } from "../../api/groups";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing } from "../../theme";

const STATE_LABEL: Record<GroupState, string> = {
  RECRUITING: "Recruiting",
  READY: "Ready to start",
  WORKING: "Working",
  COMPLETED: "Cycle complete",
  DISSOLUTION: "Dissolution vote",
  DISBANDED: "Disbanded",
};

export default function GroupsHomeScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["my-groups"], queryFn: getMyGroups });

  return (
    <View style={styles.container}>
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
                Browse recruiting groups to apply with one of your tasks, or create your own group if you're a
                Subscriber.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })}>
              <Text style={styles.cardTitle}>
                {item.name} {item.isLeader ? "👑" : ""}
              </Text>
              <Text style={styles.cardMeta}>
                {STATE_LABEL[item.state]} · Cycle {item.currentCycleNumber}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate("BrowseGroups")}>
          <Text style={styles.secondaryButtonText}>Browse groups</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            profile?.subscriptionTier === "SUBSCRIBER"
              ? navigation.navigate("CreateGroup")
              : navigation.navigate("CreateGroup", { blocked: true })
          }
        >
          <Text style={styles.primaryButtonText}>+ Create group</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: 100, flexGrow: 1 },
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
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  actions: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  secondaryButtonText: { color: colors.primary, fontWeight: "600" },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
});
