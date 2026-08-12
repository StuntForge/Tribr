import React from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { BlockedUser, getBlockedUsers, unblockUser } from "../api/profile";
import AnimatedPressable from "../components/AnimatedPressable";
import Avatar from "../components/Avatar";
import WaveHeader from "../components/WaveHeader";
import EmptyState from "../components/EmptyState";
import { InfoCard, InfoCardRow } from "../components/InfoCard";
import { colors, radii, shadows, spacing } from "../theme";

const EMPTY_IMAGE = require("../../assets/illustrations/processed/blocked-users-empty-state.png");

export default function BlockedUsersScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { data: blocked, isLoading } = useQuery({ queryKey: ["blocked-users"], queryFn: getBlockedUsers });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blocked-users"] }),
  });

  const Header = (
    <WaveHeader illustration={<View style={styles.headerIllustration}><Ionicons name="shield" size={26} color="rgba(255,255,255,0.85)" /></View>}>
      <View style={styles.topRow}>
        <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </AnimatedPressable>
      </View>
      <Text style={styles.title}>Blocked Users</Text>
      <Text style={styles.subtitle}>People you've blocked</Text>
    </WaveHeader>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Header}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={blocked}
        keyExtractor={(b) => b.userId}
        ListEmptyComponent={
          <EmptyState icon="shield" badgeIcon="ban" image={EMPTY_IMAGE} imageAspectRatio={1075 / 869} title="No blocked users" body="Members you block won't be able to invite you, message you or apply to your Tribes.">
            <View style={styles.infoCardWrap}>
              <InfoCard>
                <InfoCardRow icon="person-remove" title="Why block someone?" body="Blocking helps keep your experience safe and comfortable." />
                <InfoCardRow icon="lock-closed" title="You're in control" body="You can unblock someone at any time if you change your mind." divider />
              </InfoCard>
            </View>
          </EmptyState>
        }
        renderItem={({ item }: { item: BlockedUser }) => (
          <View style={styles.card}>
            <Avatar name={item.firstName} photoUrl={item.profilePhotoUrl} size={40} />
            <Text style={styles.name}>{item.firstName ?? "Member"}</Text>
            <AnimatedPressable
              style={styles.unblockButton}
              onPress={() => !unblockMutation.isPending && unblockMutation.mutate(item.userId)}
              disabled={unblockMutation.isPending && unblockMutation.variables === item.userId}
            >
              {unblockMutation.isPending && unblockMutation.variables === item.userId ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.unblockButtonText}>Unblock</Text>
              )}
            </AnimatedPressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 },
  headerIllustration: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    margin: 18,
  },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  infoCardWrap: { alignSelf: "stretch", marginTop: spacing.md },
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
