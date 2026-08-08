import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlockedUser, getBlockedUsers, unblockUser } from "../api/profile";
import AnimatedPressable from "../components/AnimatedPressable";
import Avatar from "../components/Avatar";
import { colors, radii, shadows, spacing } from "../theme";

export default function BlockedUsersScreen() {
  const queryClient = useQueryClient();
  const { data: blocked, isLoading } = useQuery({ queryKey: ["blocked-users"], queryFn: getBlockedUsers });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-users"] }),
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
      data={blocked}
      keyExtractor={(b) => b.userId}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptyBody}>Members you block won't be able to invite, message or apply to your groups.</Text>
        </View>
      }
      renderItem={({ item }: { item: BlockedUser }) => (
        <View style={styles.card}>
          <Avatar name={item.firstName} photoUrl={item.profilePhotoUrl} size={40} />
          <Text style={styles.name}>{item.firstName ?? "Member"}</Text>
          <AnimatedPressable style={styles.unblockButton} onPress={() => unblockMutation.mutate(item.userId)}>
            <Text style={styles.unblockButtonText}>Unblock</Text>
          </AnimatedPressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  unblockButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: spacing.md },
  unblockButtonText: { color: colors.danger, fontWeight: "700", fontSize: 12 },
});
