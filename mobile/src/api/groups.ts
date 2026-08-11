import { apiFetch } from "./client";

export type GroupState = "RECRUITING" | "READY" | "WORKING" | "COMPLETED" | "DISSOLUTION" | "DISBANDED";

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  categories: string[];
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
  approxDistanceMiles: number | null;
  sizeMin: number;
  sizeMax: number;
  memberCount: number;
  leaderName: string | null;
  leaderIsPro: boolean;
  leaderTaskPhotoUrl: string | null;
  leaderTaskCategory: string | null;
  averageMemberRating: number | null;
  state: GroupState;
  createdAt: string;
  verifiedOnly: boolean;
  minRating: number | null;
  eligibleToApply: boolean;
}

export interface MyGroupSummary {
  id: string;
  name: string;
  state: GroupState;
  currentCycleNumber: number;
  isLeader: boolean;
  leaderTaskCategory: string | null;
}

export interface GroupMemberInfo {
  userId: string;
  firstName: string | null;
  photoUrl: string | null;
  isLeader: boolean;
  isPro: boolean;
  joinedAt: string;
  rating: number | null;
  currentTask: {
    id: string;
    name: string;
    status: string;
    category: string;
    jobLength: string | null;
    photoUrl: string | null;
  } | null;
}

export interface QueueEntry {
  taskId: string;
  taskName: string;
  ownerId: string;
  ownerName: string | null;
  status: string;
  isActive: boolean;
  workDayConfirmed: boolean;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string;
  categories: { id: string; name: string }[];
  verifiedOnly: boolean;
  minRating: number | null;
  locationLabel: string | null;
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredGender: string | null;
  durationBand: string | null;
  sizeMin: number;
  sizeMax: number;
  leaderId: string;
  leaderName: string | null;
  leaderTaskPhotoUrl: string | null;
  state: GroupState;
  currentCycleNumber: number;
  isLeader: boolean;
  isMember: boolean;
  memberCount: number;
  averageMemberRating: number | null;
  pendingApplicationCount?: number;
  declinedTaskIds: string[];
  members: GroupMemberInfo[];
  queue: QueueEntry[];
  progress: { completed: number; forgone: number; total: number } | null;
  dissolutionVote: { id: string; startedAt: string; endsAt: string; outcome: string | null } | null;
}

export interface PendingApplication {
  id: string;
  applicant: { id: string; firstName: string | null; photoUrl: string | null; isPro: boolean };
  task: { id: string; name: string; category: string; jobLength: string | null };
  message: string | null;
  createdAt: string;
}

export function getMyGroups() {
  return apiFetch<MyGroupSummary[]>("/api/groups/mine");
}

export interface GroupHistoryEntry {
  id: string;
  name: string;
  state: GroupState;
  isLeader: boolean;
  myStatus: "ACTIVE" | "LEFT";
  memberCount: number;
  joinedAt: string;
  leftAt: string | null;
}

export function getGroupHistory() {
  return apiFetch<GroupHistoryEntry[]>("/api/me/group-history");
}

export interface BrowseGroupsFilters {
  categoryId?: string;
  minRating?: number;
  sizeMin?: number;
  sizeMax?: number;
  maxDistanceMiles?: number;
  jobLength?: string;
}

export function browseGroups(filters: BrowseGroupsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.minRating != null) params.set("minRating", String(filters.minRating));
  if (filters.sizeMin != null) params.set("sizeMin", String(filters.sizeMin));
  if (filters.sizeMax != null) params.set("sizeMax", String(filters.sizeMax));
  if (filters.maxDistanceMiles != null) params.set("maxDistanceMiles", String(filters.maxDistanceMiles));
  if (filters.jobLength) params.set("jobLength", filters.jobLength);
  const qs = params.toString();
  return apiFetch<GroupSummary[]>(`/api/groups/browse${qs ? `?${qs}` : ""}`);
}

export interface NearbyRecruitingGroup {
  groupId: string;
  taskId: string | null;
  taskName: string;
  taskPhotoUrl: string | null;
  approxDistanceMiles: number | null;
  memberCount: number;
  sizeMin: number;
  sizeMax: number;
  members: { firstName: string | null; photoUrl: string | null }[];
}

export function getNearbyRecruitingGroups() {
  return apiFetch<NearbyRecruitingGroup[]>("/api/groups/nearby-recruiting");
}

export function getGroup(id: string) {
  return apiFetch<GroupDetail>(`/api/groups/${id}`);
}

export interface CreateGroupInput {
  name: string;
  description: string;
  categoryIds: string[];
  sizeMin: number;
  sizeMax: number;
  taskId: string;
  verifiedOnly?: boolean;
  minRating?: number;
  preferredAgeMin?: number;
  preferredAgeMax?: number;
  durationBand?: string;
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

export function removeMember(groupId: string, userId: string) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/members/${userId}/remove`, { method: "POST" });
}

export interface KickVoteBallot {
  voterId: string;
  firstName: string | null;
  choice: "YES" | "NO";
}

export interface KickVote {
  id: string;
  groupId: string;
  target: { id: string; firstName: string | null };
  initiator: { id: string; firstName: string | null };
  reason: string;
  outcome: "REMOVED" | "FAILED" | null;
  createdAt: string;
  requiredVotes: number;
  ballots: KickVoteBallot[];
}

export function startKickVote(groupId: string, targetUserId: string, reason: string) {
  return apiFetch<{ id: string }>(`/api/groups/${groupId}/kick-votes`, {
    method: "POST",
    body: { targetUserId, reason },
  });
}

export function getGroupKickVotes(groupId: string) {
  return apiFetch<KickVote[]>(`/api/groups/${groupId}/kick-votes`);
}

export function getKickVote(voteId: string) {
  return apiFetch<KickVote>(`/api/kick-votes/${voteId}`);
}

export function castKickBallot(voteId: string, choice: "YES" | "NO") {
  return apiFetch<{ ok: true; outcome: string | null }>(`/api/kick-votes/${voteId}/ballot`, {
    method: "POST",
    body: { choice },
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

export interface Attendee {
  userId: string;
  firstName: string | null;
  profilePhotoUrl: string | null;
}

export function getAttendees(groupId: string, taskId: string) {
  return apiFetch<Attendee[]>(`/api/groups/${groupId}/tasks/${taskId}/attendees`);
}

export type AttendanceStatus = "ATTENDED" | "NO_SHOW" | "VALID_REASON";

export interface AttendanceEntry {
  userId: string;
  status: AttendanceStatus;
  performance?: number;
  attitude?: number;
  reliability?: number;
}

export function completeTask(groupId: string, taskId: string, attendance: AttendanceEntry[]) {
  return apiFetch<GroupDetail>(`/api/groups/${groupId}/tasks/${taskId}/complete`, { method: "POST", body: { attendance } });
}

export function rateHost(groupId: string, taskId: string, hosting: number, accuracy: number, attitude: number) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/tasks/${taskId}/rate-host`, {
    method: "POST",
    body: { hosting, accuracy, attitude },
  });
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

// ---------- Invitations (7.8) & previous members (7.10) ----------

export interface PreviousMember {
  userId: string;
  firstName: string | null;
  activeTasks: { id: string; name: string; category: string }[];
}

export function getPreviousMembers(groupId: string) {
  return apiFetch<PreviousMember[]>(`/api/groups/${groupId}/previous-members`);
}

export function inviteMember(groupId: string, invitedUserId: string, suggestedTaskId: string) {
  return apiFetch<{ id: string }>(`/api/groups/${groupId}/invitations`, {
    method: "POST",
    body: { invitedUserId, suggestedTaskId },
  });
}

export interface MyInvitation {
  id: string;
  group: {
    id: string;
    name: string;
    categories: string[];
    leaderName: string | null;
    leaderIsPro: boolean;
    memberCount: number;
    sizeMin: number;
    sizeMax: number;
    preferredAgeMin: number | null;
    preferredAgeMax: number | null;
    preferredGender: string | null;
    minRating: number | null;
    verifiedOnly: boolean;
    approxDistanceMiles: number | null;
  };
  suggestedTask: { id: string; name: string } | null;
}

export function getMyInvitations() {
  return apiFetch<MyInvitation[]>("/api/me/invitations");
}

export interface MyApplication {
  id: string;
  groupId: string;
  groupName: string;
  task: { id: string; name: string; category: string; jobLength: string | null };
  status: "PENDING" | "TASK_REQUESTED" | "TASK_SUGGESTED";
  rejectionReason: string | null;
  createdAt: string;
}

export function getMyApplications() {
  return apiFetch<MyApplication[]>("/api/me/applications");
}

export function withdrawApplication(groupId: string, appId: string) {
  return apiFetch<{ ok: true }>(`/api/groups/${groupId}/applications/${appId}/withdraw`, { method: "POST" });
}

export function respondToInvitation(invitationId: string, accept: boolean) {
  return apiFetch<{ ok: true }>(`/api/invitations/${invitationId}/respond`, { method: "POST", body: { accept } });
}

export interface GroupCurrentTaskMember {
  userId: string;
  firstName: string | null;
  photoUrl: string | null;
  isLeader: boolean;
  isPro: boolean;
  task: {
    id: string;
    name: string;
    description: string;
    category: string;
    jobLength: string | null;
    status: string;
    photos: { id: string; url: string }[];
  } | null;
}

export function getGroupCurrentTasks(groupId: string) {
  return apiFetch<GroupCurrentTaskMember[]>(`/api/groups/${groupId}/current-tasks`);
}
