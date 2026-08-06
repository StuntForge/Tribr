import { apiFetch } from "./client";

export type GroupState = "RECRUITING" | "READY" | "WORKING" | "COMPLETED" | "DISSOLUTION" | "DISBANDED";

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  category: string | null;
  locationLabel: string | null;
  sizeMin: number;
  sizeMax: number;
  memberCount: number;
  leaderName: string | null;
  state: GroupState;
}

export interface MyGroupSummary {
  id: string;
  name: string;
  state: GroupState;
  currentCycleNumber: number;
  isLeader: boolean;
}

export interface GroupMemberInfo {
  userId: string;
  firstName: string | null;
  isLeader: boolean;
  joinedAt: string;
  currentTask: { id: string; name: string; status: string; category: string } | null;
}

export interface QueueEntry {
  taskId: string;
  taskName: string;
  ownerId: string;
  ownerName: string | null;
  status: string;
  isActive: boolean;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string;
  category: { id: string; name: string } | null;
  locationLabel: string | null;
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredGender: string | null;
  durationBand: string | null;
  sizeMin: number;
  sizeMax: number;
  leaderId: string;
  leaderName: string | null;
  state: GroupState;
  currentCycleNumber: number;
  isLeader: boolean;
  isMember: boolean;
  memberCount: number;
  pendingApplicationCount?: number;
  members: GroupMemberInfo[];
  queue: QueueEntry[];
  dissolutionVote: { id: string; startedAt: string; endsAt: string; outcome: string | null } | null;
}

export interface PendingApplication {
  id: string;
  applicant: { id: string; firstName: string | null };
  task: { id: string; name: string; category: string; estimatedManHours: number };
  message: string | null;
  createdAt: string;
}

export function getMyGroups() {
  return apiFetch<MyGroupSummary[]>("/api/groups/mine");
}

export function browseGroups() {
  return apiFetch<GroupSummary[]>("/api/groups/browse");
}

export function getGroup(id: string) {
  return apiFetch<GroupDetail>(`/api/groups/${id}`);
}

export interface CreateGroupInput {
  name: string;
  description: string;
  categoryId?: string;
  sizeMin: number;
  sizeMax: number;
  taskId: string;
}

export function createGroup(input: CreateGroupInput) {
  return apiFetch<GroupDetail>("/api/groups", { method: "POST", body: input });
}

export function applyToGroup(groupId: string, taskId: string, message?: string) {
  return apiFetch<{ id: string; status: string }>(`/api/groups/${groupId}/apply`, {
    method: "POST",
    body: { taskId, message },
  });
}

export function getApplications(groupId: string) {
  return apiFetch<PendingApplication[]>(`/api/groups/${groupId}/applications`);
}

export type Decision = "APPROVE" | "REJECT" | "SUGGEST_TASK" | "REQUEST_TASK";

export function decideApplication(
  groupId: string,
  appId: string,
  decision: Decision,
  reason?: string,
  suggestedTaskId?: string
) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/applications/${appId}/decision`, {
    method: "POST",
    body: { decision, reason, suggestedTaskId },
  });
}

export function leaveGroup(groupId: string) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/leave`, { method: "POST" });
}

export function disbandGroup(groupId: string) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/disband`, { method: "POST" });
}

export function startWork(groupId: string) {
  return apiFetch<GroupDetail>(`/api/groups/${groupId}/start-work`, { method: "POST" });
}

export function deferTask(groupId: string, taskId: string) {
  return apiFetch<GroupDetail>(`/api/groups/${groupId}/tasks/${taskId}/defer`, { method: "POST" });
}

export function forgoTask(groupId: string, taskId: string) {
  return apiFetch<GroupDetail>(`/api/groups/${groupId}/tasks/${taskId}/forgo`, { method: "POST" });
}

export function completeTask(groupId: string, taskId: string) {
  return apiFetch<GroupDetail>(`/api/groups/${groupId}/tasks/${taskId}/complete`, { method: "POST" });
}

export function completeCycle(groupId: string, action: "DISBAND" | "START_NEW_CYCLE") {
  return apiFetch<GroupDetail>(`/api/groups/${groupId}/complete-cycle`, { method: "POST", body: { action } });
}

export function requestDissolution(groupId: string) {
  return apiFetch<{ id: string; endsAt: string }>(`/api/groups/${groupId}/dissolution/request`, { method: "POST" });
}

export function castDissolutionBallot(groupId: string, voteId: string, choice: "YES" | "NO") {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/dissolution/${voteId}/ballot`, {
    method: "POST",
    body: { choice },
  });
}
