import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { LinearTransition, SlideOutRight } from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  ActionItem,
  clearAllNotifications,
  dismissNotification,
  getActionItems,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
} from "../api/notifications";
import WaveHeader from "../components/WaveHeader";
import TribrLogo from "../components/TribrLogo";
import SegmentedTabs from "../components/SegmentedTabs";
import EmptyState from "../components/EmptyState";
import IllustrationCard from "../components/IllustrationCard";
import { InfoCard, InfoCardRow } from "../components/InfoCard";
import { resolveNotificationRoute } from "../utils/notificationNav";
import { colors, radii, shadows, spacing } from "../theme";

const HEADER_IMAGE = require("../../assets/illustrations/processed/notifications-header.png");
const EMPTY_IMAGE = require("../../assets/illustrations/processed/notifications-empty-state.png");

type Tab = "updates" | "action";

export default function NotificationsScreen({ navigation, route }: any) {
  const queryClient = useQueryClient();
  // Tapping a "daily digest" push lands here with initialTab set so it opens
  // straight on Action Needed instead of the default Updates tab.
  const [tab, setTab] = useState<Tab>(route?.params?.initialTab === "action" ? "action" : "updates");

  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 15000,
  });
  const { data: actionItems, isLoading: actionItemsLoading, refetch: refetchActionItems, isRefetching: actionItemsRefetching } = useQuery({
    queryKey: ["action-items"],
    queryFn: getActionItems,
    refetchInterval: 15000,
  });

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const dismissMutation = useMutation({
    mutationFn: dismissNotification,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<NotificationItem[]>(["notifications"]);
      queryClient.setQueryData<NotificationItem[]>(["notifications"], (old) => old?.filter((n) => n.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications"], context.previous);
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => queryClient.setQueryData<NotificationItem[]>(["notifications"], []),
  });

  const confirmClearAll = () => {
    Alert.alert("Clear all notifications?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear all", style: "destructive", onPress: () => clearAllMutation.mutate() },
    ]);
  };

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;
  const actionCount = actionItems?.length ?? 0;

  const onPressNotification = (item: NotificationItem) => {
    if (!item.read) readMutation.mutate(item.id);
    const target = resolveNotificationRoute(item.type, {
      groupId: item.groupId,
      groupName: item.groupName ?? undefined,
      taskId: item.taskId,
      voteId: item.voteId,
    });
    if (target) navigation.navigate(target.tab, target.screen ? { screen: target.screen, params: target.params } : undefined);
  };

  const onPressActionItem = (item: ActionItem) => {
    const target = resolveNotificationRoute(item.type, {
      groupId: item.groupId,
      groupName: item.groupName,
      taskId: item.taskId,
      taskName: item.taskName,
      voteId: item.voteId,
    });
    if (target) navigation.navigate(target.tab, target.screen ? { screen: target.screen, params: target.params } : undefined);
  };

  if (isLoading || actionItemsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WaveHeader illustration={<IllustrationCard source={HEADER_IMAGE} width={125} aspectRatio={1066 / 895} />}>
        <View style={styles.topRow}>
          <TribrLogo />
        </View>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.subtitle}>Stay up to date with what matters in your Tribes.</Text>
      </WaveHeader>

      <View style={styles.tabRow}>
        <SegmentedTabs
          options={[
            { value: "updates", label: `Updates${unreadCount > 0 ? ` (${unreadCount})` : ""}`, icon: "notifications" },
            { value: "action", label: `Action Needed${actionCount > 0 ? ` (${actionCount})` : ""}`, icon: "flag" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === "updates" ? (
        <>
          {(unreadCount > 0 || (notifications?.length ?? 0) > 0) && (
            <View style={styles.topActions}>
              {unreadCount > 0 && (
                <TouchableOpacity style={styles.markAllButton} onPress={() => readAllMutation.mutate()}>
                  <Text style={styles.markAllText}>Mark all {unreadCount} as read</Text>
                </TouchableOpacity>
              )}
              {(notifications?.length ?? 0) > 0 && (
                <TouchableOpacity style={styles.markAllButton} onPress={confirmClearAll}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <FlatList
            data={notifications}
            keyExtractor={(n) => n.id}
            contentContainerStyle={styles.listContent}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState icon="notifications" badgeIcon="paper-plane" image={EMPTY_IMAGE} imageAspectRatio={1069 / 859} title="No new notifications" body="Nothing here yet. You'll see invitations, approvals and reminders as they happen.">
                <View style={styles.infoCardWrap}>
                  <InfoCard>
                    <InfoCardRow icon="people" title="What you'll see here" body="Invitations - when someone invites you to join a Tribe." />
                    <InfoCardRow icon="checkmark-circle" body="Approvals - when your request to join is approved." divider />
                    <InfoCardRow icon="calendar" body="Reminders - upcoming work dates and deadlines." divider />
                  </InfoCard>
                </View>
              </EmptyState>
            }
            renderItem={({ item }) => (
              <NotificationRow item={item} onPress={() => onPressNotification(item)} onDismiss={() => dismissMutation.mutate(item.id)} />
            )}
          />
        </>
      ) : (
        <FlatList
          data={actionItems}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.listContent}
          refreshing={actionItemsRefetching}
          onRefresh={refetchActionItems}
          ListEmptyComponent={
            <EmptyState icon="flag" badgeIcon="checkmark" title="You're all caught up" body="Nothing needs your attention right now." />
          }
          renderItem={({ item }) => <ActionItemRow item={item} onPress={() => onPressActionItem(item)} />}
        />
      )}
    </View>
  );
}

function NotificationRow({ item, onPress, onDismiss }: { item: NotificationItem; onPress: () => void; onDismiss: () => void }) {
  const renderRightActions = () => (
    <View style={styles.dismissAction}>
      <Ionicons name="trash" size={20} color="#fff" />
      <Text style={styles.dismissActionText}>Dismiss</Text>
    </View>
  );

  return (
    <Animated.View exiting={SlideOutRight.duration(180)} layout={LinearTransition.duration(160)}>
      <Swipeable renderRightActions={renderRightActions} onSwipeableOpen={onDismiss} overshootRight={false} rightThreshold={56}>
        <TouchableOpacity style={[styles.card, !item.read && styles.cardUnread]} onPress={onPress}>
          {item.groupName && <Text style={styles.groupLabel}>{item.groupName}</Text>}
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}

function ActionItemRow({ item, onPress }: { item: ActionItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name="alert-circle" size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  headerTitle: { color: "#fff", fontSize: 26, fontWeight: "800", maxWidth: "65%" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4, maxWidth: "65%" },
  headerIllustration: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    margin: 18,
  },
  tabRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  infoCardWrap: { alignSelf: "stretch", marginTop: spacing.md },
  topActions: { flexDirection: "row", justifyContent: "center" },
  markAllButton: { padding: spacing.md, alignItems: "center" },
  markAllText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  clearAllText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: "#EAF4EE" },
  groupLabel: { fontSize: 11, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  body: { fontSize: 13, color: colors.text, marginTop: spacing.xs },
  time: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  dismissAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: 12,
    marginBottom: spacing.sm,
    gap: 2,
  },
  dismissActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
