export interface NotificationNavExtra {
  groupId?: string;
  groupName?: string;
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
  const { groupId, groupName, taskId, taskName, voteId } = extra;

  switch (type) {
    case "GROUP_INVITATION":
      return { tab: "Groups", screen: "MyInvitations" };

    case "APPLICATION_TASK_REQUESTED":
      return { tab: "Groups", screen: "MyInvitations", params: { initialTab: "applications" } };

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

    // Social Tribe equivalents of the scheduling group above - same
    // destination screen (SocialSchedule mirrors TaskSchedule), just no
    // per-task id since a Social Tribe has one shared activity, not a task.
    case "SOCIAL_SCHEDULING_OPENED":
    case "SOCIAL_AVAILABILITY_NEEDED":
    case "SOCIAL_DATE_SELECTED":
    case "SOCIAL_PROPOSE_DATES":
    case "SOCIAL_PICK_DATE":
    case "SOCIAL_SUBMIT_AVAILABILITY":
      return groupId ? { tab: "Groups", screen: "SocialSchedule", params: { groupId, groupName: groupName ?? "" } } : null;

    // Only the leader-facing "you need to record attendance" case actually
    // has something to do on SocialAttendance - once it's already recorded,
    // there's nothing left to submit there (a non-leader tapping "Tribe
    // complete" just wants to see the Tribe, not a dead-end attendance form).
    case "SOCIAL_ATTENDANCE_PENDING":
      return groupId ? { tab: "Groups", screen: "SocialAttendance", params: { groupId, groupName: groupName ?? "" } } : null;

    case "SOCIAL_ATTENDANCE_RECORDED":
    case "SOCIAL_TRIBE_STARTED":
    case "SOCIAL_TRIBE_EXPIRED":
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
