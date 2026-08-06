import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getMyTasks, Task, TaskStatus } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing } from "../../theme";

const STATUS_LABEL: Record<TaskStatus, string> = {
  DRAFT: "Draft",
  AVAILABLE: "Available",
  SUBMITTED: "Submitted to group",
  APPROVED: "Approved",
  ACTIVE: "Active in group",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  DRAFT: colors.textMuted,
  AVAILABLE: colors.primary,
  SUBMITTED: colors.star,
  APPROVED: colors.star,
  ACTIVE: colors.primary,
  COMPLETED: colors.textMuted,
  ARCHIVED: colors.textMuted,
};

export default function TaskLibraryScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { data: tasks, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["tasks"], queryFn: getMyTasks });

  const limit = profile?.subscriptionTier === "SUBSCRIBER" ? 20 : 1;
  const activeCount = tasks?.filter((t) => t.status !== "ARCHIVED").length ?? 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
        <Text style={styles.headerSubtitle}>
          {activeCount} of {limit} active task{limit === 1 ? "" : "s"} used
          {profile?.subscriptionTier !== "SUBSCRIBER" ? " (Free plan)" : ""}
        </Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>You haven't added a task yet</Text>
            <Text style={styles.emptyBody}>
              Add a DIY, gardening or decorating project you'd like help with. This is the task you'll offer in
              exchange for helping other members with theirs.
            </Text>
          </View>
        }
        renderItem={({ item }) => <TaskCard task={item} onPress={() => navigation.navigate("CreateEditTask", { taskId: item.id })} />}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("CreateEditTask", {})}
      >
        <Text style={styles.addButtonText}>+ Add a task</Text>
      </TouchableOpacity>
    </View>
  );
}

function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{task.name}</Text>
        <View style={[styles.badge, { borderColor: STATUS_COLOR[task.status] }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[task.status] }]}>{STATUS_LABEL[task.status]}</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {task.category.name} · {task.estimatedManHours} man hours
      </Text>
      {task.locationLabel && <Text style={styles.cardMeta}>{task.locationLabel}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  addButton: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
