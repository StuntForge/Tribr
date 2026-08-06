import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getMyInvitations } from "../api/groups";
import { getHomeSummary } from "../api/home";
import { colors, spacing } from "../theme";

export default function HomeScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { data: invitations } = useQuery({ queryKey: ["my-invitations"], queryFn: getMyInvitations });
  const { data: summary, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["home-summary"], queryFn: getHomeSummary });

  const hasNothingYet = !isLoading && summary && summary.activeGroups.length === 0 && (!invitations || invitations.length === 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View>
          <Text style={styles.greeting}>Hi {profile?.firstName ?? "there"} 👋</Text>

          {invitations && invitations.length > 0 && (
            <TouchableOpacity
              style={styles.inviteBanner}
              onPress={() => navigation.navigate("Groups", { screen: "MyInvitations" })}
              accessibilityRole="button"
            >
              <Text style={styles.inviteBannerText}>
                You have {invitations.length} pending group invitation{invitations.length === 1 ? "" : "s"} →
              </Text>
            </TouchableOpacity>
          )}

          {summary && summary.pendingApplicationsToReview > 0 && (
            <View style={styles.bannerRow}>
              <Text style={styles.bannerText}>
                {summary.pendingApplicationsToReview} application{summary.pendingApplicationsToReview === 1 ? "" : "s"} waiting on
                your review across your groups.
              </Text>
            </View>
          )}

          {isLoading && <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />}

          {summary && summary.upcomingWorkDays.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Upcoming work days</Text>
              {summary.upcomingWorkDays.map((wd) => (
                <TouchableOpacity
                  key={wd.taskId}
                  style={styles.workDayCard}
                  onPress={() => navigation.navigate("Groups", { screen: "GroupDetail", params: { groupId: wd.groupId } })}
                >
                  <Text style={styles.workDayTitle}>{wd.taskName}</Text>
                  <Text style={styles.workDayMeta}>
                    {wd.groupName} ·{" "}
                    {wd.allDay ? new Date(wd.confirmedDate).toDateString() : `${new Date(wd.confirmedDate).toDateString()} ${wd.startTime}–${wd.endTime}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {summary && summary.activeGroups.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Your groups</Text>
              {summary.activeGroups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.groupCard}
                  onPress={() => navigation.navigate("Groups", { screen: "GroupDetail", params: { groupId: g.id } })}
                >
                  <Text style={styles.groupTitle}>
                    {g.name} {g.isLeader ? "👑" : ""}
                  </Text>
                  <Text style={styles.groupMeta}>
                    {g.state} · Cycle {g.cycleNumber}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {hasNothingYet && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>You don't have any active groups yet</Text>
              <Text style={styles.cardBody}>
                Start by adding a task you'd like help with. Once you have one, you can browse or create a group
                from the Search tab.
              </Text>
              <TouchableOpacity
                style={styles.cardButton}
                onPress={() => navigation.navigate("Profile", { screen: "TaskLibrary" })}
                accessibilityRole="button"
              >
                <Text style={styles.cardButtonText}>Add a task</Text>
              </TouchableOpacity>
            </View>
          )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
  inviteBanner: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inviteBannerText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  bannerRow: {
    backgroundColor: "#EAF4EE",
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  bannerText: { color: colors.primaryDark, fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  workDayCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  workDayTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  workDayMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  groupTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  groupMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  cardBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  cardButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  cardButtonText: { color: "#fff", fontWeight: "600" },
});
