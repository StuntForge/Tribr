import React from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getMyGroups, getMyInvitations, GroupState } from "../../api/groups";
import { useAuth } from "../../context/AuthContext";
import { useUnreadMessages } from "../../hooks/useUnreadMessages";
import WaveHeader from "../../components/WaveHeader";
import TribrLogo from "../../components/TribrLogo";
import AnimatedPressable from "../../components/AnimatedPressable";
import EmptyState from "../../components/EmptyState";
import { InfoCard, InfoCardRow } from "../../components/InfoCard";
import { colors, radii, shadows, spacing } from "../../theme";

const STATE_LABEL: Record<GroupState, string> = {
  RECRUITING: "Recruiting",
  READY: "Ready to start",
  WORKING: "Working",
  COMPLETED: "Cycle complete",
  DISSOLUTION: "Dissolution vote",
  DISBANDED: "Disbanded",
};

// Matches the backend's FREE_GROUP_LIMIT / SUBSCRIBER_GROUP_LIMIT (groups.ts).
const FREE_GROUP_LIMIT = 1;
const SUBSCRIBER_GROUP_LIMIT = 6;

export default function GroupsHomeScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["my-groups"], queryFn: getMyGroups });
  const { data: invitations } = useQuery({ queryKey: ["my-invitations"], queryFn: getMyInvitations });
  const { data: unreadMessages } = useUnreadMessages();
  const unreadGroupIds = new Set(unreadMessages?.map((u) => u.groupId));

  const limit = profile?.subscriptionTier === "SUBSCRIBER" ? SUBSCRIBER_GROUP_LIMIT : FREE_GROUP_LIMIT;
  const activeCount = groups?.length ?? 0;
  const atLimit = activeCount >= limit;
  const invitationCount = invitations?.length ?? 0;

  const explainLimit = () =>
    Alert.alert(
      "You're at your group limit",
      `You're already in ${activeCount} of ${limit} group${limit === 1 ? "" : "s"} your plan allows. Leave or finish one before joining or creating another.`
    );

  return (
    <View style={styles.container}>
      <WaveHeader>
        <View style={styles.topRow}>
          <TribrLogo />
          <AnimatedPressable style={styles.bellButton} onPress={() => navigation.navigate("MyInvitations")}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {invitationCount > 0 && <View style={styles.bellBadge} />}
          </AnimatedPressable>
        </View>
        <Text style={styles.title}>Groups</Text>
        <Text style={styles.subtitle}>Work together. Get things done.</Text>
      </WaveHeader>

      <View style={styles.menuRow}>
        <MenuButton
          icon="search"
          label="Find a group"
          disabled={atLimit}
          onPress={() => (atLimit ? explainLimit() : navigation.navigate("BrowseGroups"))}
        />
        <MenuButton
          icon="mail-open"
          label="Invitations"
          badge={invitationCount > 0 ? invitationCount : undefined}
          onPress={() => navigation.navigate("MyInvitations")}
        />
        <MenuButton
          icon="add-circle"
          label="Create a group"
          disabled={atLimit}
          onPress={() =>
            atLimit
              ? explainLimit()
              : profile?.subscriptionTier === "SUBSCRIBER"
                ? navigation.navigate("CreateGroup")
                : navigation.navigate("CreateGroup", { blocked: true })
          }
        />
      </View>
      {atLimit && (
        <Text style={styles.limitNote}>
          You're at your plan's group limit ({activeCount}/{limit}) - Find a group and Create a group are turned off until you leave or finish one.
        </Text>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <EmptyState
              icon="people"
              badgeIcon="hand-left"
              title="You're not in a group yet"
              body={'Tap "Find a group" above to apply with one of your tasks, or create your own group if you\'re a Subscriber.'}
            >
              <View style={styles.infoCardWrap}>
                <InfoCard>
                  <InfoCardRow icon="people" title="Better together" body="Join local people, help each other out and get more done." />
                </InfoCard>
              </View>
            </EmptyState>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>
                  {item.name} {item.isLeader ? "👑" : ""}
                </Text>
                {unreadGroupIds.has(item.id) && (
                  <View style={styles.unreadPill}>
                    <Ionicons name="chatbubble" size={11} color="#fff" />
                    <Text style={styles.unreadPillText}>New</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardMeta}>
                {STATE_LABEL[item.state]} · Cycle {item.currentCycleNumber}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function MenuButton({
  icon,
  label,
  onPress,
  disabled,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <AnimatedPressable style={[styles.menuButton, disabled && styles.menuButtonDisabled]} onPress={onPress}>
      <View>
        <Ionicons name={icon} size={22} color={disabled ? colors.textMuted : "#fff"} />
        {badge != null && (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.menuButtonText, disabled && styles.menuButtonTextDisabled]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  bellButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 },
  menuRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  menuButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 6,
    ...shadows.raised,
  },
  menuButtonDisabled: { backgroundColor: colors.border, ...shadows.card },
  menuButtonText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
  menuButtonTextDisabled: { color: colors.textMuted },
  menuBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  menuBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  limitNote: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    lineHeight: 17,
  },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100, flexGrow: 1 },
  infoCardWrap: { alignSelf: "stretch", marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
  unreadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  unreadPillText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
