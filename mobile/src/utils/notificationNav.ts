export interface NotificationNavExtra {
  groupId?: string;
  taskId?: string;
  taskName?: string;
  voteId?: string;
}

export interface ResolvedNotificationRoute {
  tab: string;
  screen?: string;
  params?: Record<string, unknown>;
}

// Shared by the in-app Notifications screen (both the "Updates" feed and the
// "Action Needed" tab) and by tapping a push notification, so both paths
// always land on the same place for a given type. Work-day reminders arrive
// as "REMINDER_24H:<workDayId>" (the suffix is how the server dedupes them),
// so the suffix is stripped before matching.
export function resolveNotificationRoute(rawType: string | undefined, extra: NotificationNavExtra = {}): ResolvedNotificationRoute | null {
  if (!rawType) return null;
  const type = rawType.split(":")[0];
  const { groupId, taskId, taskName, voteId } = extra;

  switch (type) {
    case "GROUP_INVITATION":
      return { tab: "Groups", screen: "MyInvitations" };

    case "KICK_VOTE_OUTCOME":
    case "KICK_VOTE_STARTED":
    case "KICK_VOTE":
      if (voteId) return { tab: "Groups", screen: "KickVote", params: { voteId } };
      return groupId ? { tab: "Groups", screen: "GroupDetail", params: { groupId } } : null;

    case "TASK_ACTIVE":
    case "DATES_PROPOSED":
    case "DATES_REVISED":
    case "AVAILABILITY_READY":
    case "REMINDER_24H":
    case "REMINDER_SAME_DAY":
    case "PROPOSE_DATES":
    case "PICK_DATE":
    case "SUBMIT_AVAILABILITY":
      if (groupId && taskId) return { tab: "Groups", screen: "TaskSchedule", params: { groupId, taskId, taskName: taskName ?? "" } };
      return groupId ? { tab: "Groups", screen: "GroupDetail", params: { groupId } } : null;

    case "RATE_HOST_PENDING":
    case "RATE_HOST":
      return groupId && taskId ? { tab: "Groups", screen: "RateHost", params: { groupId, taskId } } : null;

    case "REVIEW_APPLICATIONS":
      return groupId ? { tab: "Groups", screen: "Applications", params: { groupId } } : null;

    case "DAILY_DIGEST":
      return { tab: "Notifications", screen: "NotificationsHome", params: { initialTab: "action" } };

    case "ANNOUNCEMENT":
      return { tab: "Notifications", screen: "NotificationsHome" };

    default:
      return groupId ? { tab: "Groups", screen: "GroupDetail", params: { groupId } } : null;
  }
}
