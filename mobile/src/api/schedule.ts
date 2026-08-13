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
  // The window (inclusive, "YYYY-MM-DD") dates can be proposed in - anchored
  // to when this task became active, not to today.
  windowStart: string;
  windowEnd: string;
  proposal: {
    id: string;
    revisionUsed: boolean;
    mySubmitted: boolean;
    allSubmitted: boolean;
    requiredSubmitterCount: number;
    submittedCount: number;
    options: DateOptionInfo[];
  } | null;
  workDay: {
    confirmedDate: string;
    allDay: boolean;
    startTime: string | null;
    endTime: string | null;
    foodProvided: boolean;
    address: string | null;
    locationLat: number | null;
    locationLng: number | null;
    addressHiddenFromMe: boolean;
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

export function submitAvailability(groupId: string, taskId: string, availableDateOptionIds: string[]) {
  return apiFetch<{ ok: true; allSubmitted: boolean }>(`/api/groups/${groupId}/tasks/${taskId}/availability-submit`, {
    method: "POST",
    body: { availableDateOptionIds },
  });
}

export function reviseDates(groupId: string, taskId: string, options: ProposeDateOption[]) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/tasks/${taskId}/availability-revise`, {
    method: "POST",
    body: { options },
  });
}

export function confirmWorkDay(groupId: string, taskId: string, dateOptionId: string, foodProvided: boolean) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/tasks/${taskId}/confirm`, {
    method: "POST",
    body: { dateOptionId, foodProvided },
  });
}
