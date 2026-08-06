import { apiFetch } from "./client";

export interface DateOptionInfo {
  id: string;
  date: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  myResponse: boolean | null;
  availableCount: number;
  unavailableCount: number;
  availableMembers: (string | null)[];
  dietary?: string[];
}

export interface ScheduleInfo {
  isOwner: boolean;
  proposal: { id: string; options: DateOptionInfo[] } | null;
  workDay: {
    confirmedDate: string;
    allDay: boolean;
    startTime: string | null;
    endTime: string | null;
    foodProvided: boolean;
    address: string | null;
  } | null;
}

export function getSchedule(groupId: string, taskId: string) {
  return apiFetch<ScheduleInfo>(`/api/groups/${groupId}/tasks/${taskId}/schedule`);
}

export interface ProposeDateOption {
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
}

export function proposeDates(groupId: string, taskId: string, options: ProposeDateOption[]) {
  return apiFetch<{ id: string }>(`/api/groups/${groupId}/tasks/${taskId}/availability-proposals`, {
    method: "POST",
    body: { options },
  });
}

export function respondAvailability(groupId: string, taskId: string, dateOptionId: string, available: boolean) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/tasks/${taskId}/availability-responses`, {
    method: "POST",
    body: { dateOptionId, available },
  });
}

export function confirmWorkDay(groupId: string, taskId: string, dateOptionId: string, foodProvided: boolean) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/tasks/${taskId}/confirm`, {
    method: "POST",
    body: { dateOptionId, foodProvided },
  });
}
