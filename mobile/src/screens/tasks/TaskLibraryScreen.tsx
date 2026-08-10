import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { LinearTransition, SlideOutRight } from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { deleteTask, getMyTasks, Task, TaskStatus } from "../../api/tasks";
import { useAuth } from "../../context/AuthContext";
import WaveHeader from "../../components/WaveHeader";
import TribrLogo from "../../components/TribrLogo";
import AnimatedPressable from "../../components/AnimatedPressable";
import SegmentedTabs from "../../components/SegmentedTabs";
import EmptyState from "../../components/EmptyState";
import { InfoCard, InfoCardRow } from "../../components/InfoCard";
import { colors, radii, spacing } from "../../theme";

const EMPTY_IMAGE = require("../../../assets/illustrations/processed/task-library-empty-state.png");
const ADD_BUTTON_IMAGE = require("../../../assets/illustrations/processed/add-task-button.png");
const ADD_BUTTON_IMAGE_PRESSED = require("../../../assets/illustrations/processed/add-task-button-onclick.png");
const ADD_BUTTON_ASPECT_RATIO = 1413 / 433;

const STATUS_LABEL: Record<TaskStatus, string> = {
  DRAFT: "Draft",
  AVAILABLE: "Available",
  SUBMITTED: "Submitted to Tribe",
  APPROVED: "Assigned",
  ACTIVE: "Active in Tribe",
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
  const [addButtonPressed, setAddButtonPressed] = useState(false);

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
        <View style={styles.simpleHeader}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </AnimatedPressable>
          <Text style={styles.simpleHeaderTitle}>Completed Tasks</Text>
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
      <WaveHeader>
        <View style={styles.topRow}>
          <TribrLogo />
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Tasks</Text>
          <AnimatedPressable
            onPress={onAddTask}
            onPressIn={() => setAddButtonPressed(true)}
            onPressOut={() => setAddButtonPressed(false)}
            disabled={atLimit}
          >
            <Image
              source={addButtonPressed ? ADD_BUTTON_IMAGE_PRESSED : ADD_BUTTON_IMAGE}
              style={[styles.addButtonImage, atLimit && styles.addButtonImageDisabled]}
              resizeMode="contain"
            />
          </AnimatedPressable>
        </View>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>
            {countedActiveTasks.length} of {limit} active task{limit === 1 ? "" : "s"} used
          </Text>
          <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.75)" />
        </View>
      </WaveHeader>

      <View style={styles.tabRow}>
        <SegmentedTabs
          options={[
            { value: "active", label: `Active Tasks (${activeTasks.length})`, icon: "clipboard" },
            { value: "archived", label: `Archived Tasks (${archivedTasks.length})`, icon: "archive" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === "active" ? (
        <FlatList
          data={activeTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <EmptyState
              icon="clipboard"
              badgeIcon="leaf"
              image={EMPTY_IMAGE}
              imageAspectRatio={1190 / 948}
              title="You haven't added a task yet"
              body="Add a DIY, gardening or decorating project you'd like help with. This is the task you'll offer in exchange for helping other members with theirs."
            >
              <View style={styles.infoCardWrap}>
                <InfoCard>
                  <InfoCardRow icon="people" title="Tip: Add a great task" body="The more detail you add, the easier it is to find the right people to help (and for others to help you)." />
                </InfoCard>
              </View>
            </EmptyState>
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
    </View>
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
  simpleHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  simpleHeaderTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addButtonImage: { width: 117, height: 117 / ADD_BUTTON_ASPECT_RATIO },
  addButtonImageDisabled: { opacity: 0.5 },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  tabRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100, flexGrow: 1 },
  infoCardWrap: { alignSelf: "stretch", marginTop: spacing.md },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
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
});
