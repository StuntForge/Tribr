import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { LinearTransition, SlideOutRight } from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { deleteTask, getMyTasks, Task, TaskStatus } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import { colors, radii, spacing } from "../../theme";

const STATUS_LABEL: Record<TaskStatus, string> = {
  DRAFT: "Draft",
  AVAILABLE: "Available",
  SUBMITTED: "Submitted to group",
  APPROVED: "Assigned",
  ACTIVE: "Active in group",
  COMPLETED: "Completed",
  ARCHIVED: "Completed",
  FORGONE: "Forgone this cycle",
  USER_ARCHIVED: "Archived",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  DRAFT: colors.textMuted,
  AVAILABLE: colors.primary,
  SUBMITTED: colors.star,
  APPROVED: colors.star,
  ACTIVE: colors.primary,
  COMPLETED: colors.textMuted,
  ARCHIVED: colors.textMuted,
  FORGONE: colors.textMuted,
  USER_ARCHIVED: colors.textMuted,
};

type Tab = "active" | "archived";

export default function TaskLibraryScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: tasks, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["tasks"], queryFn: getMyTasks });
  const mode = route.params?.mode as "completed" | undefined;
  const [tab, setTab] = useState<Tab>("active");

  const limit = profile?.subscriptionTier === "SUBSCRIBER" ? 20 : 1;
  const activeTasks = tasks?.filter((t) => t.status !== "ARCHIVED" && t.status !== "USER_ARCHIVED") ?? [];
  const archivedTasks = tasks?.filter((t) => t.status === "USER_ARCHIVED") ?? [];
  const completedTasks = tasks?.filter((t) => t.status === "ARCHIVED") ?? [];
  // Drafts don't exist anymore going forward, but legacy ones (created before
  // this limit gating existed) don't count against it either - matches the
  // backend's own NON_COUNTING_STATUSES check.
  const countedActiveTasks = tasks?.filter((t) => t.status !== "ARCHIVED" && t.status !== "USER_ARCHIVED" && t.status !== "DRAFT") ?? [];
  const atLimit = countedActiveTasks.length >= limit;

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueryData<Task[]>(["tasks"]);
      queryClient.setQueryData<Task[]>(["tasks"], (old) => old?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks"], context.previous);
    },
  });

  const onAddTask = () => {
    if (atLimit) {
      Alert.alert(
        "You're at your task limit",
        profile?.subscriptionTier === "SUBSCRIBER"
          ? `Subscribers can maintain up to ${limit} active tasks. Archive or complete one first.`
          : `Free members can maintain 1 active task at a time. Subscribe to add more, or finish your current one first.`
      );
      return;
    }
    navigation.navigate("CreateEditTask", {});
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (mode === "completed") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Completed Tasks</Text>
        </View>
        <FlatList
          data={completedTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>No completed tasks yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => navigation.navigate("TaskDetail", { taskId: item.id })} />
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
        <Text style={styles.headerSubtitle}>
          {countedActiveTasks.length} of {limit} active task{limit === 1 ? "" : "s"} used
          {profile?.subscriptionTier !== "SUBSCRIBER" ? " (Free plan)" : ""}
        </Text>
      </View>

      <View style={styles.tabRow}>
        <TabButton label="Active Tasks" count={activeTasks.length} active={tab === "active"} onPress={() => setTab("active")} />
        <TabButton label="Archived Tasks" count={archivedTasks.length} active={tab === "archived"} onPress={() => setTab("archived")} />
      </View>

      {tab === "active" ? (
        <FlatList
          data={activeTasks}
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
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => navigation.navigate("CreateEditTask", { taskId: item.id })} />
          )}
        />
      ) : (
        <FlatList
          data={archivedTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>
                Nothing archived. Archive an available task from its details screen to shelve it without it counting
                toward your task limit.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ArchivedTaskRow
              task={item}
              onPress={() => navigation.navigate("CreateEditTask", { taskId: item.id })}
              onDelete={() => deleteMutation.mutate(item.id)}
            />
          )}
        />
      )}

      {tab === "active" && (
        <TouchableOpacity
          style={[styles.addButton, atLimit && styles.addButtonDisabled]}
          onPress={onAddTask}
          accessibilityRole="button"
          accessibilityLabel="Add a task"
        >
          <Text style={styles.addButtonText}>{atLimit ? "Task limit reached" : "+ Add a task"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TabButton({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );
}

function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
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

function ArchivedTaskRow({ task, onPress, onDelete }: { task: Task; onPress: () => void; onDelete: () => void }) {
  const confirmDelete = () => {
    Alert.alert("Delete this task?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };

  const renderRightActions = () => (
    <TouchableOpacity style={styles.deleteAction} onPress={confirmDelete}>
      <Ionicons name="trash" size={20} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View exiting={SlideOutRight.duration(220)} layout={LinearTransition.springify().damping(18)}>
      <Swipeable renderRightActions={renderRightActions} overshootRight={false} rightThreshold={56}>
        <TaskCard task={task} onPress={onPress} />
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  tabRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  tabButtonTextActive: { color: "#fff" },
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
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: 12,
    marginBottom: spacing.sm,
    gap: 2,
  },
  deleteActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
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
  addButtonDisabled: { backgroundColor: colors.border },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
