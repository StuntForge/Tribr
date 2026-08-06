import { apiFetch } from "./client";

export interface HomeActiveGroup {
  id: string;
  name: string;
  state: string;
  isLeader: boolean;
  cycleNumber: number;
}

export interface HomeUpcomingWorkDay {
  groupId: string;
  groupName: string;
  taskId: string;
  taskName: string;
  confirmedDate: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface HomeSummary {
  activeGroups: HomeActiveGroup[];
  pendingApplicationsToReview: number;
  upcomingWorkDays: HomeUpcomingWorkDay[];
}

export function getHomeSummary() {
  return apiFetch<HomeSummary>("/api/me/home-summary");
}
