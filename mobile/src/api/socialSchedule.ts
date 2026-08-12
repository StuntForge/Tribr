import { apiFetch } from "./client";

export interface SocialDateOptionInfo {
  id: string;
  date: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  myResponse: boolean | null;
  availableCount: number;
  unavailableCount: number;
  availableMembers: (string | null)[];
}

export interface SocialScheduleInfo {
  isLeader: boolean;
  windowStart: string;
  windowEnd: string;
  proposal: {
    id: string;
    revisionUsed: boolean;
    mySubmitted: boolean;
    allSubmitted: boolean;
    requiredSubmitterCount: number;
    submittedCount: number;
    options: SocialDateOptionInfo[];
  } | null;
  socialEvent: { confirmedDate: string; allDay: boolean; startTime: string | null; endTime: string | null } | null;
}

export function getSocialSchedule(groupId: string) {
  return apiFetch<SocialScheduleInfo>(`/api/groups/${groupId}/social/schedule`);
}

export interface ProposeSocialDateOption {
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
}

export function proposeSocialDates(groupId: string, options: ProposeSocialDateOption[]) {
  return apiFetch<{ id: string }>(`/api/groups/${groupId}/social/propose-dates`, { method: "POST", body: { options } });
}

export function reviseSocialDates(groupId: string, options: ProposeSocialDateOption[]) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/social/revise-dates`, { method: "POST", body: { options } });
}

export function submitSocialAvailability(groupId: string, availableDateOptionIds: string[]) {
  return apiFetch<{ ok: true; allSubmitted: boolean }>(`/api/groups/${groupId}/social/availability-submit`, {
    method: "POST",
    body: { availableDateOptionIds },
  });
}

export function confirmSocialEvent(groupId: string, dateOptionId: string) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/social/confirm`, { method: "POST", body: { dateOptionId } });
}

export interface CommittedMember {
  userId: string;
  firstName: string | null;
  profilePhotoUrl: string | null;
}

export function getCommittedMembers(groupId: string) {
  return apiFetch<CommittedMember[]>(`/api/groups/${groupId}/social/committed-members`);
}

export type SocialAttendanceStatus = "ATTENDED" | "NO_SHOW" | "VALID_REASON";

export interface SocialAttendanceEntry {
  userId: string;
  status: SocialAttendanceStatus;
}

export function recordSocialAttendance(groupId: string, attendance: SocialAttendanceEntry[]) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/social/attendance`, { method: "POST", body: { attendance } });
}
