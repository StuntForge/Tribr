import { apiFetch } from "./client";

export interface ChatMessage {
  id: string;
  isSystem: boolean;
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  photoUrl: string | null;
  createdAt: string;
}

export function getMessages(groupId: string) {
  return apiFetch<ChatMessage[]>(`/api/groups/${groupId}/messages`);
}

export function sendMessage(groupId: string, text?: string, photoUrl?: string) {
  return apiFetch<ChatMessage>(`/api/groups/${groupId}/messages`, { method: "POST", body: { text, photoUrl } });
}

export interface UnreadGroupMessages {
  groupId: string;
  groupName: string;
  unreadCount: number;
}

export function getUnreadMessages() {
  return apiFetch<UnreadGroupMessages[]>("/api/me/unread-messages");
}
