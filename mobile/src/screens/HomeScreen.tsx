import React, { useEffect, useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { getMyRatingBreakdown, setLookingForGroup } from "../api/profile";
import { getHomeSummary } from "../api/home";
import { getTask } from "../api/tasks";
import { getAttendees } from "../api/groups";
import { useUnreadMessages } from "../hooks/useUnreadMessages";
import AnimatedPressable from "../components/AnimatedPressable";
import Avatar from "../components/Avatar";
import Reveal from "../components/Reveal";
import WaveHeader from "../components/WaveHeader";
import TribrLogo from "../components/TribrLogo";
import IconCircle from "../components/IconCircle";
import IllustrationCard from "../components/IllustrationCard";
import NearbyGroupsCarousel from "../components/NearbyGroupsCarousel";
import { colors, radii, shadows, spacing, type } from "../theme";

const NEXT_TASK_EMPTY_IMAGE = require("../../assets/illustrations/processed/home-next-task-empty-state.png");
const INVITATIONS_ON_IMAGE = require("../../assets/illustrations/processed/invitations-on.png");
const INVITATIONS_OFF_IMAGE = require("../../assets/illustrations/processed/invitations-off.png");
const INVITATIONS_ON_ASPECT_RATIO = 1254 / 335;
const INVITATIONS_OFF_ASPECT_RATIO = 1416 / 273;
// The brief asked for double the old 160 width, but there isn't room for a
// literal 2x (320) next to the avatar/name block on a real phone screen -
// this is as large as it can go without pushing the greeting text into an
// awkward wrap.
const INVITATIONS_IMAGE_WIDTH = 240;
const TOGGLE_FLIP_DELAY = 160;

export default function HomeScreen({ navigation }: any) {
  const { profile, refreshProfile } = useAuth();
  const [toggling, setToggling] = useState(false);
  const [lookingDisplay, setLookingDisplay] = useState(profile?.lookingForGroup ?? false);

  useEffect(() => {
    if (profile) setLookingDisplay(profile.lookingForGroup);
  }, [profile?.lookingForGroup]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["rating-breakdown"],
    queryFn: getMyRatingBreakdown,
    enabled: breakdownOpen,
  });

  const { data: unreadMessages } = useUnreadMessages();
  const unreadGroupCount = unreadMessages?.length ?? 0;

  const { data: homeSummary, refetch: refetchHomeSummary } = useQuery({
    queryKey: ["home-summary"],
    queryFn: getHomeSummary,
  });
  const nextWorkDay = homeSummary?.upcomingWorkDays[0] ?? null;

  const { data: nextTask } = useQuery({
    queryKey: ["tasks", nextWorkDay?.taskId],
    queryFn: () => getTask(nextWorkDay!.taskId),
    enabled: Boolean(nextWorkDay),
  });
  const { data: attendees } = useQuery({
    queryKey: ["attendees", nextWorkDay?.groupId, nextWorkDay?.taskId],
    queryFn: () => getAttendees(nextWorkDay!.groupId, nextWorkDay!.taskId),
    enabled: Boolean(nextWorkDay),
  });

  const onToggleLooking = () => {
    if (toggling || !profile) return;
    const next = !profile.lookingForGroup;
    setToggling(true);
    setTimeout(async () => {
      setLookingDisplay(next);
      try {
        await setLookingForGroup(next);
        await refreshProfile();
      } catch {
        setLookingDisplay(!next);
      } finally {
        setToggling(false);
      }
    }, TOGGLE_FLIP_DELAY);
  };

  if (!profile) return null;

  let cardIndex = 0;
  const nextDelay = () => cardIndex++ * 70;

  const workDate = nextWorkDay
    ? new Date(nextWorkDay.confirmedDate).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => { refreshProfile(); refetchHomeSummary(); }} tintColor={colors.primary} />}
    >
      <WaveHeader>
        <View style={styles.topRow}>
          <View style={styles.logoCenter} pointerEvents="none">
            <TribrLogo />
          </View>
          <View style={{ flex: 1 }} />
          <AnimatedPressable style={styles.bellButton} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </AnimatedPressable>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400 }}
          style={styles.heroRow}
        >
          <View style={styles.heroLeft}>
            <View style={styles.avatarRing}>
              <Avatar name={profile.firstName} photoUrl={profile.profilePhotoUrl} size={72} />
            </View>
            <View>
              <Text style={styles.greetingEyebrow}>Welcome back</Text>
              <Text style={styles.greeting}>{profile.firstName} 👋</Text>
              <Text style={styles.meta}>
                {profile.age} · {profile.gender} · {profile.locationLabel}
              </Text>
            </View>
          </View>

          <View style={styles.heroRight}>
            <AnimatedPressable onPress={onToggleLooking} disabled={toggling}>
              <Image
                source={lookingDisplay ? INVITATIONS_ON_IMAGE : INVITATIONS_OFF_IMAGE}
                style={{
                  width: INVITATIONS_IMAGE_WIDTH,
                  height: INVITATIONS_IMAGE_WIDTH / (lookingDisplay ? INVITATIONS_ON_ASPECT_RATIO : INVITATIONS_OFF_ASPECT_RATIO),
                }}
                resizeMode="contain"
              />
            </AnimatedPressable>
          </View>
        </MotiView>
      </WaveHeader>

      <Reveal delay={nextDelay()}>
        <AnimatedPressable style={styles.ratingHero} onPress={() => setBreakdownOpen((v) => !v)}>
          <View style={styles.ratingHeroLeft}>
            <Ionicons name="star" size={30} color={colors.star} />
            <Text style={styles.ratingHeroValue}>{profile.overallRating != null ? profile.overallRating.toFixed(1) : "—"}</Text>
          </View>
          <View style={styles.ratingHeroDivider} />
          <View style={styles.ratingHeroRight}>
            <View style={styles.ratingBreakdownItem}>
              <Ionicons name="hammer" size={13} color="#fff" />
              <Text style={styles.ratingHeroBreakdownText}>
                Worker {profile.workerRating != null ? profile.workerRating.toFixed(1) : "—"}
              </Text>
            </View>
            <View style={styles.ratingBreakdownItem}>
              <Ionicons name="home" size={13} color="#fff" />
              <Text style={styles.ratingHeroBreakdownText}>
                Host {profile.hostRating != null ? profile.hostRating.toFixed(1) : "—"}
              </Text>
            </View>
          </View>
          <Ionicons name={breakdownOpen ? "chevron-up" : "chevron-forward"} size={18} color="rgba(255,255,255,0.85)" />
        </AnimatedPressable>
      </Reveal>

      {breakdownOpen && (
        <Reveal>
          <View style={styles.breakdownCard}>
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
            {breakdownLoading ? (
              <Text style={styles.breakdownLoading}>Loading breakdown…</Text>
            ) : breakdown ? (
              <View style={styles.fullBreakdown}>
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
              </View>
            ) : null}
            {breakdown && breakdown.worker.count + breakdown.host.count < 25 && (
              <Text style={styles.seedNote}>
                New accounts start with a hidden 3-star baseline so a handful of early ratings can't swing your score
                wildly. It fades out as real ratings build up, and disappears once you've had 25 or more.
              </Text>
            )}
          </View>
        </Reveal>
      )}

      <Reveal delay={nextDelay()}>
        <AnimatedPressable
          style={styles.messagesCard}
          onPress={() => setMessagesOpen((v) => !v)}
          disabled={unreadGroupCount === 0}
        >
          <View style={styles.messagesHeaderRow}>
            <IconCircle icon="chatbubbles" size={40} bg={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.messagesTitle}>Messages</Text>
              <Text style={styles.messagesSubtitle}>
                {unreadGroupCount === 0
                  ? "You're all caught up"
                  : `${unreadGroupCount} Tribe${unreadGroupCount === 1 ? "" : "s"} with new messages`}
              </Text>
            </View>
            <Ionicons name={messagesOpen && unreadGroupCount > 0 ? "chevron-up" : "chevron-forward"} size={16} color={colors.textMuted} />
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

      {nextWorkDay ? (
        <Reveal delay={nextDelay()}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Up next</Text>
            <AnimatedPressable
              onPress={() => navigation.navigate("Groups", { screen: "GroupCurrentTasks", params: { groupId: nextWorkDay.groupId, groupName: nextWorkDay.groupName } })}
            >
              <Text style={styles.seeAllLink}>See all</Text>
            </AnimatedPressable>
          </View>
          <AnimatedPressable
            style={styles.upNextCard}
            onPress={() => navigation.navigate("Groups", { screen: "TaskDetail", params: { taskId: nextWorkDay.taskId } })}
          >
            <View style={styles.upNextRow}>
              {nextTask?.photos?.[0] ? (
                <Image source={{ uri: nextTask.photos[0].url }} style={styles.upNextPhoto} />
              ) : (
                <View style={[styles.upNextPhoto, styles.upNextPhotoPlaceholder]}>
                  <Ionicons name="calendar" size={32} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.upNextTitleRow}>
                  <View style={styles.upNextCalendarBadge}>
                    <Ionicons name="calendar" size={13} color={colors.primary} />
                  </View>
                  <Text style={styles.upNextTitle} numberOfLines={1}>
                    {nextWorkDay.taskName}
                  </Text>
                </View>
                <Text style={styles.upNextMeta}>
                  {workDate}
                  {!nextWorkDay.allDay && nextWorkDay.startTime ? ` · ${nextWorkDay.startTime}` : ""}
                </Text>
                {attendees && attendees.length > 0 && (
                  <View style={styles.upNextAttendingRow}>
                    <Ionicons name="people" size={13} color={colors.textMuted} />
                    <Text style={styles.upNextMeta}>{attendees.length} member{attendees.length === 1 ? "" : "s"} attending</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            {attendees && attendees.length > 0 && (
              <View style={styles.avatarStack}>
                {attendees.slice(0, 4).map((a, i) => (
                  <View key={a.userId} style={[styles.avatarStackItem, { marginLeft: i === 0 ? 0 : -12 }]}>
                    <Avatar name={a.firstName ?? "?"} photoUrl={a.profilePhotoUrl} size={32} />
                  </View>
                ))}
              </View>
            )}
          </AnimatedPressable>
        </Reveal>
      ) : (
        <Reveal delay={nextDelay()}>
          <View style={styles.nextTaskEmptyCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextTaskEmptyTitle}>Your next task</Text>
              <Text style={styles.nextTaskEmptyBody}>
                You don't have an upcoming task yet. Join a Tribe and start helping each other.
              </Text>
              <AnimatedPressable
                style={styles.browseGroupsButton}
                onPress={() => navigation.navigate("Groups", { screen: "BrowseGroups" })}
              >
                <Text style={styles.browseGroupsButtonText}>Browse Tribes</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </AnimatedPressable>
            </View>
            <IllustrationCard source={NEXT_TASK_EMPTY_IMAGE} width={120} aspectRatio={1273 / 966} rounded={radii.lg} />
          </View>
        </Reveal>
      )}

      <Reveal delay={nextDelay()}>
        <Text style={styles.sectionHeading}>Your progress</Text>
        <View style={styles.progressCard}>
          <StatHalf
            icon="checkmark"
            value={profile.completedTasksCount}
            label="Tasks done"
            onPress={() => navigation.navigate("Tasks", { screen: "TaskLibrary", params: { mode: "completed" } })}
          />
          <View style={styles.progressDivider} />
          <StatHalf
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

      <Reveal delay={nextDelay()}>
        <NearbyGroupsCarousel
          onSeeAll={() => navigation.navigate("Groups", { screen: "BrowseGroups" })}
          onPressCard={(groupId) => navigation.navigate("Groups", { screen: "GroupDetail", params: { groupId } })}
        />
      </Reveal>
    </ScrollView>
  );
}

function StatHalf({
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
    <AnimatedPressable style={styles.statHalf} onPress={onPress}>
      <IconCircle icon={icon} size={36} bg={colors.primaryLight} color={colors.primary} iconSize={18} />
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
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  logoCenter: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bellButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  greetingEyebrow: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  greeting: { color: "#fff", fontSize: 21, fontWeight: "700", marginTop: 1 },
  meta: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  heroRight: { alignItems: "center", justifyContent: "center" },
  ratingHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.raised,
  },
  ratingHeroLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  ratingHeroValue: { color: "#fff", fontSize: 32, fontWeight: "800" },
  ratingHeroDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.25)" },
  ratingHeroRight: { flex: 1, gap: 4 },
  ratingHeroBreakdownText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  ratingBreakdownRow: { flexDirection: "row", gap: spacing.md },
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
  breakdownLoading: { ...type.caption, marginTop: spacing.sm },
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
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  messagesHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeading: { ...type.h3, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  seeAllLink: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  upNextCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  upNextRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  upNextPhoto: { width: 84, height: 84, borderRadius: radii.md },
  upNextPhotoPlaceholder: { backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  upNextTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  upNextCalendarBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  upNextTitle: { ...type.h3, flex: 1 },
  upNextMeta: { ...type.small, marginTop: 4 },
  upNextAttendingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  avatarStack: { flexDirection: "row", marginTop: spacing.md },
  avatarStackItem: { borderWidth: 2, borderColor: colors.surface, borderRadius: 16 },
  nextTaskEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  nextTaskEmptyTitle: { ...type.h3, marginBottom: spacing.xs },
  nextTaskEmptyBody: { ...type.body, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  browseGroupsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  browseGroupsButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  nextTaskEmptyIllustration: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
  nextTaskEmptyBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surfaceAlt,
  },
  progressCard: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  progressDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  statHalf: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
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
