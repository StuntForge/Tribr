import React, { useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getGroup, GroupMemberInfo, leaveGroup } from "../../api/groups";
import { blockUser, getBlockedUsers, unblockUser } from "../../api/profile";
import { addFavourite, getFavourites, removeFavourite } from "../../api/search";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import AnimatedPressable from "../../components/AnimatedPressable";
import Avatar from "../../components/Avatar";
import ProBadge from "../../components/ProBadge";
import { colors, radii, shadows, spacing, type } from "../../theme";

// Replaces the old cycle-restart mechanic: once every task is done, every
// member (not just the leader) leaves individually from this screen. As
// each person completes, they drop off everyone else's member list here -
// refetching on an interval is what makes that feel live without the
// remaining members needing to back out and back in.
export default function CompleteTribeScreen({ route, navigation }: any) {
  const { groupId, groupName } = route.params as { groupId: string; groupName?: string };
  const { profile } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState("");

  const { data: group, isLoading, refetch } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId),
    refetchInterval: 5000,
  });
  const { data: favourites } = useQuery({ queryKey: ["favourites"], queryFn: getFavourites });
  const { data: blocked } = useQuery({ queryKey: ["blocked-users"], queryFn: getBlockedUsers });
  const queryClient = useQueryClient();

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const completeMutation = useMutation({
    mutationFn: () => leaveGroup(groupId, message.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-history"] });
      toast.show("You've left the Tribe");
      navigation.navigate("GroupsHome");
    },
    onError: () => toast.show("Couldn't leave the Tribe - please try again."),
  });

  if (isLoading || !group) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={group.members}
        keyExtractor={(m) => m.userId}
        ListHeaderComponent={
          <View style={styles.header}>
            <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
            <Text style={styles.title}>{groupName ?? group.name} is done!</Text>
            <Text style={styles.subtitle}>
              Say goodbye, favourite anyone you'd want to work with again, and leave whenever you're ready. Once
              everyone's left, this Tribe wraps up for good.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            isSelf={item.userId === profile?.id}
            isFavourite={favourites?.some((f) => f.userId === item.userId) ?? false}
            isBlocked={blocked?.some((b) => b.userId === item.userId) ?? false}
            onPress={() => navigation.navigate("PublicProfile", { userId: item.userId })}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.messageLabel}>Message to the Tribe (optional)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Say something before you go..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.completeButton, completeMutation.isPending && styles.buttonDisabled]}
              onPress={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        }
      />
    </KeyboardAvoidingView>
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
        <Avatar name={member.firstName} photoUrl={member.photoUrl} size={44} />
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
            onPress={() => favouriteMutation.mutate()}
          >
            <Ionicons name={isFavourite ? "star" : "star-outline"} size={14} color={isFavourite ? "#fff" : colors.star} />
            <Text style={[styles.actionButtonText, isFavourite && styles.actionButtonTextActive]}>
              {isFavourite ? "Favourited" : "Favourite"}
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.actionButton, styles.dangerButton, isBlocked && styles.dangerButtonActive]}
            onPress={() => blockMutation.mutate()}
          >
            <Ionicons name={isBlocked ? "lock-open" : "lock-closed"} size={14} color={isBlocked ? "#fff" : colors.danger} />
            <Text style={[styles.dangerButtonText, isBlocked && styles.actionButtonTextActive]}>{isBlocked ? "Unblock" : "Block"}</Text>
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
  header: { alignItems: "center", marginBottom: spacing.lg, gap: spacing.xs },
  title: { ...type.h2, textAlign: "center" },
  subtitle: { ...type.caption, textAlign: "center", lineHeight: 18 },
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
  footer: { marginTop: spacing.md },
  messageLabel: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  messageInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 70,
    textAlignVertical: "top",
    color: colors.text,
    marginBottom: spacing.md,
  },
  completeButton: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
});
