import React from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { getMyGroups, getMyInvitations, GroupState } from "../../api/groups";
import { useAuth } from "../../context/AuthContext";
import { useUnreadMessages } from "../../hooks/useUnreadMessages";
import WaveHeader from "../../components/WaveHeader";
import TribrLogo from "../../components/TribrLogo";
import AnimatedPressable from "../../components/AnimatedPressable";
import EmptyState from "../../components/EmptyState";
import IllustrationCard from "../../components/IllustrationCard";
import { InfoCard, InfoCardRow } from "../../components/InfoCard";
import { categoryThumbnail } from "../../constants/categoryThumbnails";
import { colors, radii, shadows, spacing } from "../../theme";

const GROUPS_EMPTY_IMAGE = require("../../../assets/illustrations/processed/groups-empty-state.png");
const BETTER_TOGETHER_IMAGE = require("../../../assets/illustrations/processed/home-page-better-together.png");

const STATE_LABEL: Record<GroupState, string> = {
  RECRUITING: "Recruiting",
  READY: "Ready to start",
  WORKING: "Working",
  COMPLETED: "Work complete",
  DISSOLUTION: "Dissolution vote",
  DISBANDED: "Disbanded",
};

// Matches the backend's FREE_GROUP_LIMIT / SUBSCRIBER_GROUP_LIMIT (groups.ts).
const FREE_GROUP_LIMIT = 1;
const SUBSCRIBER_GROUP_LIMIT = 6;

export default function GroupsHomeScreen({ navigation }: any) {
  const { profile } = useAuth();
  // Polled (not just invalidated on local mutations) because membership can
  // change from someone else's action - the leader approving your
  // application on their own device, for instance - which nothing on this
  // device would otherwise know to refetch for.
  const { data: groups, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["my-groups"],
    queryFn: getMyGroups,
    refetchInterval: 15000,
  });
  const { data: invitations } = useQuery({ queryKey: ["my-invitations"], queryFn: getMyInvitations });
  const { data: unreadMessages } = useUnreadMessages();
  const unreadGroupIds = new Set(unreadMessages?.map((u) => u.groupId));

  const limit = profile?.subscriptionTier === "SUBSCRIBER" ? SUBSCRIBER_GROUP_LIMIT : FREE_GROUP_LIMIT;
  const activeCount = groups?.length ?? 0;
  const atLimit = activeCount >= limit;
  const invitationCount = invitations?.length ?? 0;

  const explainLimit = () =>
    Alert.alert(
      "You're at your Tribe limit",
      `You're already in ${activeCount} of ${limit} Tribe${limit === 1 ? "" : "s"} your plan allows. Leave or finish one before joining or creating another.`
    );

  return (
    <View style={styles.container}>
      <WaveHeader>
        <View style={styles.topRow}>
          <View style={styles.logoCenter} pointerEvents="none">
            <TribrLogo />
          </View>
          <View style={{ flex: 1 }} />
          <AnimatedPressable style={styles.bellButton} onPress={() => navigation.navigate("MyInvitations")}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {invitationCount > 0 && <View style={styles.bellBadge} />}
          </AnimatedPressable>
        </View>
        <Text style={styles.title}>Tribes</Text>
        <Text style={styles.subtitle}>Work together. Get things done.</Text>
      </WaveHeader>

      <View style={styles.menuRow}>
        <MenuButton
          icon="search"
          label="Find a Tribe"
          disabled={atLimit}
          onPress={() => (atLimit ? explainLimit() : navigation.navigate("BrowseGroups"))}
        />
        <MenuButton
          icon="mail-open"
          label="Invitations & Applications"
          badge={invitationCount > 0 ? invitationCount : undefined}
          onPress={() => navigation.navigate("MyInvitations")}
        />
        <MenuButton
          icon="add-circle"
          label="Form a Tribe"
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
          You're at your plan's Tribe limit ({activeCount}/{limit}) - Find a Tribe and Form a Tribe are turned off until you leave or finish one.
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
              image={GROUPS_EMPTY_IMAGE}
              imageAspectRatio={1403 / 881}
              title="You're not in a Tribe yet"
              body={'Tap "Find a Tribe" above to apply with one of your tasks, or form your own Tribe if you\'re a Subscriber.'}
            >
              <View style={styles.infoCardWrap}>
                <InfoCard>
                  <View style={styles.betterTogetherRow}>
                    <View style={{ flex: 1 }}>
                      <InfoCardRow icon="people" title="Better together" body="Join local people, help each other out and get more done." />
                    </View>
                    <IllustrationCard source={BETTER_TOGETHER_IMAGE} width={56} aspectRatio={1231 / 945} rounded={radii.md} />
                  </View>
                </InfoCard>
              </View>
            </EmptyState>
          }
          renderItem={({ item }) => {
            const thumbnail = categoryThumbnail(item.leaderTaskCategory);
            return (
              <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("GroupDetail", { groupId: item.id })}>
                {thumbnail ? (
                  <Image source={thumbnail} style={styles.cardThumbnail} />
                ) : (
                  <View style={[styles.cardThumbnail, styles.cardThumbnailFallback]}>
                    <Ionicons name="people" size={20} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
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
                </View>
              </TouchableOpacity>
            );
          }}
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
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  logoCenter: { position: "absolute", left: 0, right: 0, alignItems: "center" },
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
  betterTogetherRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardThumbnail: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  cardThumbnailFallback: { alignItems: "center", justifyContent: "center" },
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
