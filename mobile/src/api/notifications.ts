import { apiFetch } from "./client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  groupId?: string;
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
