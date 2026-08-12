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

export interface HomeUpcomingSocialEvent {
  groupId: string;
  groupName: string;
  confirmedDate: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface HomeSummary {
  activeGroups: HomeActiveGroup[];
  pendingApplicationsToReview: number;
  upcomingWorkDays: HomeUpcomingWorkDay[];
  upcomingSocialEvents: HomeUpcomingSocialEvent[];
}

export function getHomeSummary() {
  return apiFetch<HomeSummary>("/api/me/home-summary");
}
