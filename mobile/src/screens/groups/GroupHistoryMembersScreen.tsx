import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getGroup, GroupMemberInfo } from "../../api/groups";
import { blockUser, getBlockedUsers, unblockUser } from "../../api/profile";
import { addFavourite, getFavourites, removeFavourite } from "../../api/search";
import { useAuth } from "../../context/AuthContext";
import AnimatedPressable from "../../components/AnimatedPressable";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { colors, radii, shadows, spacing } from "../../theme";

export default function GroupHistoryMembersScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string; groupName?: string };
  const { profile } = useAuth();

  const { data: group, isLoading } = useQuery({ queryKey: ["group", groupId], queryFn: () => getGroup(groupId) });
  const { data: favourites } = useQuery({ queryKey: ["favourites"], queryFn: getFavourites });
  const { data: blocked } = useQuery({ queryKey: ["blocked-users"], queryFn: getBlockedUsers });

  if (isLoading || !group) {
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
      data={group.members}
      keyExtractor={(m) => m.userId}
      renderItem={({ item }) => (
        <MemberRow
          member={item}
          isSelf={item.userId === profile?.id}
          isFavourite={favourites?.some((f) => f.userId === item.userId) ?? false}
          isBlocked={blocked?.some((b) => b.userId === item.userId) ?? false}
          onPress={() => navigation.navigate("PublicProfile", { userId: item.userId })}
        />
      )}
    />
  );
}

function MemberRow({
  member,
  isSelf,
  isFavourite,
  isBlocked,
  onPress,
}: {
  member: GroupMemberInfo;
  isSelf: boolean;
  isFavourite: boolean;
  isBlocked: boolean;
  onPress: () => void;
}) {
  const queryClient = useQueryClient();

  const favouriteMutation = useMutation({
    mutationFn: () => (isFavourite ? removeFavourite(member.userId) : addFavourite(member.userId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favourites"] }),
  });

  const blockMutation = useMutation({
    mutationFn: () => (isBlocked ? unblockUser(member.userId) : blockUser(member.userId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-users"] }),
  });

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.identity} onPress={onPress} disabled={isSelf}>
        <Avatar name={member.firstName} photoUrl={null} size={44} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {member.firstName ?? "Member"} {member.isLeader ? "👑" : ""}
            </Text>
            {member.isPro && <ProBadge size="tiny" />}
          </View>
          {isSelf && <Text style={styles.selfTag}>You</Text>}
        </View>
        {!isSelf && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
      </TouchableOpacity>
      {!isSelf && (
        <View style={styles.actions}>
          <AnimatedPressable
            style={[styles.actionButton, isFavourite && styles.actionButtonActive]}
            onPress={() => !favouriteMutation.isPending && favouriteMutation.mutate()}
            disabled={favouriteMutation.isPending}
          >
            {favouriteMutation.isPending ? (
              <ActivityIndicator size="small" color={isFavourite ? "#fff" : colors.star} />
            ) : (
              <Ionicons name={isFavourite ? "star" : "star-outline"} size={14} color={isFavourite ? "#fff" : colors.star} />
            )}
            <Text style={[styles.actionButtonText, isFavourite && styles.actionButtonTextActive]}>
              {isFavourite ? "Favourited" : "Favourite"}
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.actionButton, styles.dangerButton, isBlocked && styles.dangerButtonActive]}
            onPress={() => !blockMutation.isPending && blockMutation.mutate()}
            disabled={blockMutation.isPending}
          >
            {blockMutation.isPending ? (
              <ActivityIndicator size="small" color={isBlocked ? "#fff" : colors.danger} />
            ) : (
              <Ionicons name={isBlocked ? "lock-open" : "lock-closed"} size={14} color={isBlocked ? "#fff" : colors.danger} />
            )}
            <Text style={[styles.dangerButtonText, isBlocked && styles.actionButtonTextActive]}>
              {isBlocked ? "Unblock" : "Block"}
            </Text>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { padding: spacing.lg, flexGrow: 1 },
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
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  selfTag: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  actions: { gap: spacing.xs },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.star,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
  },
  actionButtonActive: { backgroundColor: colors.star, borderColor: colors.star },
  actionButtonText: { fontSize: 11, fontWeight: "700", color: colors.star },
  actionButtonTextActive: { color: "#fff" },
  dangerButton: { borderColor: colors.danger },
  dangerButtonActive: { backgroundColor: colors.danger },
  dangerButtonText: { fontSize: 11, fontWeight: "700", color: colors.danger },
});
