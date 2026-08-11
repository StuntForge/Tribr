import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getGroupCurrentTasks, GroupCurrentTaskMember } from "../../api/groups";
import { jobLengthLabel } from "../../constants/jobLength";
import PhotoGallery from "../../components/PhotoGallery";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { colors, radii, shadows, spacing } from "../../theme";

export default function GroupCurrentTasksScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string; groupName?: string };
  const { data: members, isLoading } = useQuery({
    queryKey: ["group-current-tasks", groupId],
    queryFn: () => getGroupCurrentTasks(groupId),
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
      data={members}
      keyExtractor={(m) => m.userId}
      ListEmptyComponent={<Text style={styles.emptyBody}>No members yet.</Text>}
      renderItem={({ item }) => (
        <MemberTaskCard
          member={item}
          onViewUser={() => navigation.navigate("PublicProfile", { userId: item.userId })}
          onViewTask={() => item.task && navigation.navigate("TaskDetail", { taskId: item.task.id })}
        />
      )}
    />
  );
}

function MemberTaskCard({
  member,
  onViewUser,
  onViewTask,
}: {
  member: GroupCurrentTaskMember;
  onViewUser: () => void;
  onViewTask: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <Avatar name={member.firstName} photoUrl={member.photoUrl} size={32} />
        <Text style={styles.name}>
          {member.firstName ?? "Member"} {member.isLeader ? "👑" : ""}
        </Text>
        {member.isPro && <ProBadge size="tiny" />}
      </View>
      {member.task ? (
        <>
          <View style={styles.taskHeaderRow}>
            <Text style={styles.taskName}>{member.task.name}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{member.task.category}</Text>
            </View>
          </View>
          <Text style={styles.taskMeta}>{jobLengthLabel(member.task.jobLength)}</Text>
          <Text style={styles.taskDescription}>{member.task.description}</Text>
          {member.task.photos.length > 0 && (
            <View style={styles.photoWrap}>
              <PhotoGallery photos={member.task.photos} thumbSize={80} />
            </View>
          )}
        </>
      ) : (
        <Text style={styles.noTask}>No task this cycle</Text>
      )}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.viewButton} onPress={onViewUser}>
          <Ionicons name="person" size={13} color={colors.primary} />
          <Text style={styles.viewButtonText}>View User</Text>
        </TouchableOpacity>
        {member.task && (
          <TouchableOpacity style={styles.viewButton} onPress={onViewTask}>
            <Ionicons name="document-text" size={13} color={colors.primary} />
            <Text style={styles.viewButtonText}>View Task</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  taskHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.xs },
  taskName: { fontSize: 14, fontWeight: "700", color: colors.primary, flex: 1 },
  categoryBadge: { backgroundColor: colors.primaryLight, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  categoryBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  taskMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  taskDescription: { fontSize: 13, color: colors.text, marginTop: spacing.xs, lineHeight: 19 },
  photoWrap: { marginTop: spacing.sm },
  noTask: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, fontStyle: "italic" },
  buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  viewButtonText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
});
