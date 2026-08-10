import { apiFetch } from "./client";

export interface JobCategory {
  id: string;
  name: string;
}

export type TaskStatus =
  | "DRAFT"
  | "AVAILABLE"
  | "SUBMITTED"
  | "APPROVED"
  | "ACTIVE"
  | "COMPLETED"
  | "ARCHIVED"
  | "FORGONE"
  | "USER_ARCHIVED";

export interface Task {
  id: string;
  name: string;
  category: JobCategory;
  description: string;
  jobLength: string | null;
  locationType: "HOME" | "CHOOSE";
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
  exactAddress: string | null;
  notes: string | null;
  status: TaskStatus;
  groupId: string | null;
  photos: { id: string; url: string }[];
  createdAt: string;
  updatedAt: string;
}

export function getJobCategories() {
  return apiFetch<JobCategory[]>("/api/job-categories");
}

export function getMyTasks() {
  return apiFetch<Task[]>("/api/tasks");
}

export function getTask(id: string) {
  return apiFetch<Task>(`/api/tasks/${id}`);
}

export interface PublicTask {
  id: string;
  name: string;
  category: JobCategory;
  description: string;
  jobLength: string | null;
  locationLabel: string | null;
  status: TaskStatus;
  photos: { id: string; url: string }[];
  ownerId: string;
  ownerFirstName: string | null;
}

export function getPublicTask(id: string) {
  return apiFetch<PublicTask>(`/api/tasks/${id}/public`);
}

export type TaskLocationInput =
  | { type: "HOME" }
  | { type: "CHOOSE"; label: string; lat?: number; lng?: number; exactAddress?: string };

export interface TaskInput {
  name: string;
  categoryId: string;
  description: string;
  jobLength: string;
  location: TaskLocationInput;
  notes?: string;
  isDraft?: boolean;
}

export function createTask(input: TaskInput) {
  return apiFetch<Task>("/api/tasks", { method: "POST", body: input });
}

export function updateTask(id: string, input: Partial<TaskInput>) {
  return apiFetch<Task>(`/api/tasks/${id}`, { method: "PUT", body: input });
}

export function publishTask(id: string) {
  return apiFetch<Task>(`/api/tasks/${id}/publish`, { method: "POST" });
}

export function archiveTask(id: string) {
  return apiFetch<Task>(`/api/tasks/${id}/archive`, { method: "POST" });
}

export function activateTask(id: string) {
  return apiFetch<Task>(`/api/tasks/${id}/activate`, { method: "POST" });
}

export function deleteTask(id: string) {
  return apiFetch<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" });
}

export function addTaskPhoto(taskId: string, url: string) {
  return apiFetch<{ id: string; url: string }>(`/api/tasks/${taskId}/photos`, { method: "POST", body: { url } });
}

export function removeTaskPhoto(taskId: string, photoId: string) {
  return apiFetch<{ ok: true }>(`/api/tasks/${taskId}/photos/${photoId}`, { method: "DELETE" });
}
