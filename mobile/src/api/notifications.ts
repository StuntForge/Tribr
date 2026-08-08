import { apiFetch } from "./client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  groupId?: string;
  groupName?: string | null;
  taskId?: string;
  voteId?: string;
  read: boolean;
  createdAt: string;
}

export function getNotifications() {
  return apiFetch<NotificationItem[]>("/api/notifications");
}

export function markNotificationRead(id: string) {
  return apiFetch<{ ok: true }>(`/api/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiFetch<{ ok: true }>("/api/notifications/read-all", { method: "POST" });
}

export function dismissNotification(id: string) {
  return apiFetch<{ ok: true }>(`/api/notifications/${id}`, { method: "DELETE" });
}

export function clearAllNotifications() {
  return apiFetch<{ ok: true }>("/api/notifications", { method: "DELETE" });
}

export interface ActionItem {
  id: string;
  type: string;
  title: string;
  body: string;
  groupId?: string;
  taskId?: string;
  taskName?: string;
  voteId?: string;
  createdAt: string;
}

// Live-computed "things you actually have to do" - not stored notifications,
// so there's no dismiss/clear for these; they only disappear once the
// underlying action is done.
export function getActionItems() {
  return apiFetch<ActionItem[]>("/api/notifications/me/action-items");
}
