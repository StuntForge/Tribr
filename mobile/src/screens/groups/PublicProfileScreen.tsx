import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blockUser, getPublicProfile, reportUser } from "../../api/profile";
import { addFavourite, getFavourites, removeFavourite } from "../../api/search";
import { colors, spacing } from "../../theme";

export default function PublicProfileScreen({ route, navigation }: any) {
  const { userId, groupIdToInviteTo, activeTasks } = route.params as {
    userId: string;
    groupIdToInviteTo?: string;
    activeTasks?: { id: string; name: string; category: string }[];
  };
  const queryClient = useQueryClient();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data: profile, isLoading } = useQuery({ queryKey: ["public-profile", userId], queryFn: () => getPublicProfile(userId) });
  const { data: favourites } = useQuery({ queryKey: ["favourites"], queryFn: getFavourites });
  const isFavourite = favourites?.some((f) => f.userId === userId) ?? false;

  const favouriteMutation = useMutation({
    mutationFn: () => (isFavourite ? removeFavourite(userId) : addFavourite(userId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favourites"] }),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: () => {
      Alert.alert("Blocked");
      navigation.goBack();
    },
  });

  const confirmBlock = () => {
    Alert.alert("Block this member?", "They won't be able to invite, message or apply to your groups.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => blockMutation.mutate() },
    ]);
  };

  const confirmReport = () => {
    Alert.alert("Report this member?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          await reportUser(userId, "Reported from profile");
          Alert.alert("Report submitted");
        },
      },
    ]);
  };

  if (isLoading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {profile.profilePhotoUrl && <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />}
        <Text style={styles.name}>{profile.firstName}</Text>
        <Text style={styles.meta}>
          {profile.age} · {profile.gender}
          {profile.approxDistanceMiles != null ? ` · ${profile.approxDistanceMiles} mi away` : ""}
        </Text>
        <Text style={styles.ratingText}>
          {profile.overallRating != null ? `★ ${profile.overallRating.toFixed(1)}` : "No ratings yet"}
        </Text>
        <Text style={styles.ratingSub}>{profile.completedCycles} cycles completed</Text>
        {profile.overallRating != null && (
          <TouchableOpacity onPress={() => setShowBreakdown((v) => !v)}>
            <Text style={styles.breakdownToggle}>{showBreakdown ? "Hide" : "Show"} rating breakdown</Text>
          </TouchableOpacity>
        )}
        {showBreakdown && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownItem}>Worker: {profile.workerRating != null ? `★ ${profile.workerRating.toFixed(1)}` : "—"}</Text>
            <Text style={styles.breakdownItem}>Host: {profile.hostRating != null ? `★ ${profile.hostRating.toFixed(1)}` : "—"}</Text>
          </View>
        )}
      </View>

      <Text style={styles.bio}>{profile.bio}</Text>

      {profile.skills.length > 0 && (
        <Section title="Skills">
          <ChipRow items={profile.skills} />
        </Section>
      )}
      {profile.tools.length > 0 && (
        <Section title="Tools">
          <ChipRow items={profile.tools} />
        </Section>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => favouriteMutation.mutate()}>
          <Text style={styles.secondaryButtonText}>{isFavourite ? "★ Favourited" : "☆ Favourite"}</Text>
        </TouchableOpacity>
        {groupIdToInviteTo && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              navigation.navigate("InviteToGroup", { groupId: groupIdToInviteTo, userId, userName: profile.firstName, activeTasks })
            }
          >
            <Text style={styles.primaryButtonText}>Invite to group</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={confirmReport}>
          <Text style={styles.linkDanger}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmBlock}>
          <Text style={styles.linkDanger}>Block</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: spacing.sm },
  name: { fontSize: 22, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  ratingText: { fontSize: 14, fontWeight: "600", color: colors.star, marginTop: spacing.sm },
  ratingSub: { fontSize: 12, color: colors.textMuted },
  breakdownToggle: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: spacing.sm },
  breakdownRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  breakdownItem: { fontSize: 13, color: colors.text },
  bio: { fontSize: 14, color: colors.text, textAlign: "center", marginBottom: spacing.lg, lineHeight: 20 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontSize: 13 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, justifyContent: "center" },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  secondaryButtonText: { color: colors.primary, fontWeight: "600" },
  linkDanger: { color: colors.danger, fontSize: 13, fontWeight: "600" },
});
