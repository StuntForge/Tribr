import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsRead, markNotificationRead, NotificationItem } from "../api/notifications";
import { colors, spacing } from "../theme";

export default function NotificationsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 15000,
  });

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  const onPress = (item: NotificationItem) => {
    if (!item.read) readMutation.mutate(item.id);
    if (item.groupId) {
      navigation.navigate("Groups", { screen: "GroupDetail", params: { groupId: item.groupId } });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllButton} onPress={() => readAllMutation.mutate()}>
          <Text style={styles.markAllText}>Mark all {unreadCount} as read</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContent}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>Nothing here yet. You'll see invitations, approvals and reminders as they happen.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, !item.read && styles.cardUnread]} onPress={() => onPress(item)}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  markAllButton: { padding: spacing.md, alignItems: "center" },
  markAllText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: "#EAF4EE" },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  body: { fontSize: 13, color: colors.text, marginTop: spacing.xs },
  time: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
});
