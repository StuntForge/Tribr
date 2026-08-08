import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useAuth } from "../context/AuthContext";
import { getMyRatingBreakdown, setLookingForGroup } from "../api/profile";
import { useUnreadMessages } from "../hooks/useUnreadMessages";
import AnimatedPressable from "../components/AnimatedPressable";
import Avatar from "../components/Avatar";
import Reveal from "../components/Reveal";
import { colors, radii, shadows, spacing, type } from "../theme";

export default function HomeScreen({ navigation }: any) {
  const { profile, refreshProfile } = useAuth();
  const [toggling, setToggling] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["rating-breakdown"],
    queryFn: getMyRatingBreakdown,
    enabled: breakdownOpen,
  });

  const { data: unreadMessages } = useUnreadMessages();
  const unreadGroupCount = unreadMessages?.length ?? 0;

  if (!profile) return null;

  const onToggleLooking = async () => {
    setToggling(true);
    try {
      await setLookingForGroup(!profile.lookingForGroup);
      await refreshProfile();
    } finally {
      setToggling(false);
    }
  };

  let cardIndex = 0;
  const nextDelay = () => cardIndex++ * 70;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refreshProfile} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 160" pointerEvents="none">
          <Circle cx="20" cy="0" r="70" fill={colors.primaryDark} opacity={0.3} />
          <Circle cx="300" cy="150" r="90" fill={colors.accent} opacity={0.2} />
        </Svg>
        <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 400 }}>
          <View style={styles.avatarRing}>
            <Avatar name={profile.firstName} photoUrl={profile.profilePhotoUrl} size={92} />
          </View>
          <Text style={styles.greetingEyebrow}>Welcome back</Text>
          <Text style={styles.greeting}>{profile.firstName} 👋</Text>
          <Text style={styles.meta}>
            {profile.age} · {profile.gender} · {profile.locationLabel}
          </Text>
        </MotiView>
      </View>

      <Reveal delay={nextDelay()}>
        <AnimatedPressable
          style={[styles.lookingBanner, profile.lookingForGroup && styles.lookingBannerActive]}
          onPress={onToggleLooking}
          disabled={toggling}
        >
          <View style={styles.lookingIcon}>
            <Ionicons name={profile.lookingForGroup ? "eye" : "eye-off-outline"} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.lookingTitle}>
              {profile.lookingForGroup ? "Looking for a new group" : "Not currently looking"}
            </Text>
            <Text style={styles.lookingSubtitle}>
              {profile.lookingForGroup
                ? "Group leaders can see you're open to invitations."
                : "Turn this on to signal you'd welcome an invite."}
            </Text>
          </View>
          <View style={[styles.switchTrack, profile.lookingForGroup && styles.switchTrackActive]}>
            <View style={[styles.switchThumb, profile.lookingForGroup && styles.switchThumbActive]} />
          </View>
        </AnimatedPressable>
      </Reveal>

      <Reveal delay={nextDelay()}>
        <AnimatedPressable style={styles.ratingCard} onPress={() => setBreakdownOpen((v) => !v)}>
          <View style={styles.ratingHeaderRow}>
            <Ionicons name="star" size={20} color={colors.star} />
            <Text style={styles.ratingHeaderText}>
              {profile.overallRating != null ? profile.overallRating.toFixed(1) : "No ratings yet"}
            </Text>
            <View style={{ flex: 1 }} />
            <Ionicons name={breakdownOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
          </View>
          <View style={styles.ratingBreakdownRow}>
            <View style={styles.ratingBreakdownItem}>
              <Ionicons name="hammer" size={14} color={colors.primary} />
              <Text style={styles.ratingBreakdownText}>
                Worker {profile.workerRating != null ? profile.workerRating.toFixed(1) : "—"}
              </Text>
            </View>
            <View style={styles.ratingBreakdownItem}>
              <Ionicons name="home" size={14} color={colors.primary} />
              <Text style={styles.ratingBreakdownText}>
                Host {profile.hostRating != null ? profile.hostRating.toFixed(1) : "—"}
              </Text>
            </View>
          </View>

          {breakdownOpen && (
            <>
              <View style={styles.fullBreakdown}>
                {breakdownLoading ? (
                  <Text style={styles.breakdownLoading}>Loading breakdown…</Text>
                ) : breakdown ? (
                  <>
                    <View style={styles.breakdownColumn}>
                      <Text style={styles.breakdownColumnTitle}>Worker ({breakdown.worker.count})</Text>
                      <BreakdownLine label="Performance" value={breakdown.worker.performance} />
                      <BreakdownLine label="Attitude" value={breakdown.worker.attitude} />
                      <BreakdownLine label="Reliability" value={breakdown.worker.reliability} />
                    </View>
                    <View style={styles.breakdownColumn}>
                      <Text style={styles.breakdownColumnTitle}>Host ({breakdown.host.count})</Text>
                      <BreakdownLine label="Hosting" value={breakdown.host.hosting} />
                      <BreakdownLine label="Accuracy" value={breakdown.host.accuracy} />
                      <BreakdownLine label="Attitude" value={breakdown.host.attitude} />
                    </View>
                  </>
                ) : null}
              </View>
              {breakdown && breakdown.worker.count + breakdown.host.count < 25 && (
                <Text style={styles.seedNote}>
                  New accounts start with a hidden 3-star baseline so a handful of early ratings can't swing your
                  score wildly. It fades out as real ratings build up, and disappears once you've had 25 or more.
                </Text>
              )}
            </>
          )}
        </AnimatedPressable>
      </Reveal>

      <Reveal delay={nextDelay()}>
        <AnimatedPressable
          style={styles.messagesCard}
          onPress={() => setMessagesOpen((v) => !v)}
          disabled={unreadGroupCount === 0}
        >
          <View style={styles.messagesHeaderRow}>
            <View style={styles.messagesIcon}>
              <Ionicons name="chatbubbles" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.messagesTitle}>Messages</Text>
              <Text style={styles.messagesSubtitle}>
                {unreadGroupCount === 0
                  ? "You're all caught up"
                  : `${unreadGroupCount} group${unreadGroupCount === 1 ? "" : "s"} with new messages`}
              </Text>
            </View>
            {unreadGroupCount > 0 && (
              <Ionicons name={messagesOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
            )}
          </View>

          {messagesOpen && unreadMessages && (
            <View style={styles.messagesList}>
              {unreadMessages.map((m) => (
                <AnimatedPressable
                  key={m.groupId}
                  style={styles.messageRow}
                  onPress={() => navigation.navigate("Groups", { screen: "GroupChat", params: { groupId: m.groupId } })}
                >
                  <Text style={styles.messageRowName} numberOfLines={1}>
                    {m.groupName}
                  </Text>
                  <View style={styles.messageRowBadge}>
                    <Text style={styles.messageRowBadgeText}>{m.unreadCount > 99 ? "99+" : m.unreadCount}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </AnimatedPressable>
              ))}
            </View>
          )}
        </AnimatedPressable>
      </Reveal>

      <Reveal delay={nextDelay()}>
        <View style={styles.statsRow}>
          <StatTile
            icon="checkmark-done"
            value={profile.completedTasksCount}
            label="Tasks done"
            onPress={() => navigation.navigate("Tasks", { screen: "TaskLibrary", params: { mode: "completed" } })}
          />
          <StatTile
            icon="refresh"
            value={profile.completedCycles}
            label="Cycles done"
            onPress={() => navigation.navigate("Groups", { screen: "GroupHistory" })}
          />
        </View>
      </Reveal>

      {profile.bio ? (
        <Reveal delay={nextDelay()}>
          <View style={styles.bioCard}>
            <Ionicons name="chatbox-ellipses" size={16} color={colors.accent} style={{ marginBottom: 4 }} />
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        </Reveal>
      ) : null}
    </ScrollView>
  );
}

function StatTile({
  icon,
  value,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  onPress?: () => void;
}) {
  return (
    <AnimatedPressable style={styles.statTile} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

function BreakdownLine({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.breakdownLine}>
      <Text style={styles.breakdownLineLabel}>{label}</Text>
      <Text style={styles.breakdownLineValue}>{value != null ? value.toFixed(1) : "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    overflow: "hidden",
    ...shadows.raised,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    marginBottom: spacing.sm,
    alignSelf: "center",
  },
  greetingEyebrow: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600", textAlign: "center" },
  greeting: { color: "#fff", fontSize: 24, fontWeight: "700", textAlign: "center", marginTop: 2 },
  meta: { color: "rgba(255,255,255,0.8)", fontSize: 13, textAlign: "center", marginTop: spacing.xs },
  lookingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  lookingBannerActive: { backgroundColor: colors.primaryLight },
  lookingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  lookingTitle: { ...type.bodyMedium },
  lookingSubtitle: { ...type.caption, marginTop: 2 },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: "center",
  },
  switchTrackActive: { backgroundColor: colors.primary },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  switchThumbActive: { alignSelf: "flex-end" },
  ratingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  ratingHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  ratingHeaderText: { fontSize: 18, fontWeight: "700", color: colors.text },
  ratingBreakdownRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  ratingBreakdownItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingBreakdownText: { ...type.small },
  fullBreakdown: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownLoading: { ...type.caption },
  seedNote: { ...type.caption, marginTop: spacing.sm, lineHeight: 16, fontStyle: "italic" },
  breakdownColumn: { flex: 1, gap: 4 },
  breakdownColumnTitle: { fontSize: 12, fontWeight: "700", color: colors.text, marginBottom: 2 },
  breakdownLine: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLineLabel: { fontSize: 12, color: colors.textMuted },
  breakdownLineValue: { fontSize: 12, fontWeight: "600", color: colors.text },
  messagesCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  messagesHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  messagesIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesTitle: { ...type.bodyMedium },
  messagesSubtitle: { ...type.caption, marginTop: 2 },
  messagesList: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  messageRowName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  messageRowBadge: {
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  messageRowBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  statTile: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.text },
  statLabel: { ...type.caption },
  bioCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  bio: { ...type.body, lineHeight: 21, color: colors.textMuted },
});
