import { apiFetch } from "./client";

export interface JobCategory {
  id: string;
  name: string;
}

export type TaskStatus = "DRAFT" | "AVAILABLE" | "SUBMITTED" | "APPROVED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface Task {
  id: string;
  name: string;
  category: JobCategory;
  description: string;
  estimatedManHours: number;
  locationType: "HOME" | "CHOOSE";
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
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

export type TaskLocationInput =
  | { type: "HOME" }
  | { type: "CHOOSE"; label: string; lat?: number; lng?: number };

export interface TaskInput {
  name: string;
  categoryId: string;
  description: string;
  estimatedManHours: number;
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

export function deleteTask(id: string) {
  return apiFetch<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" });
}

export function addTaskPhoto(taskId: string, url: string) {
  return apiFetch<{ id: string; url: string }>(`/api/tasks/${taskId}/photos`, { method: "POST", body: { url } });
}

export function removeTaskPhoto(taskId: string, photoId: string) {
  return apiFetch<{ ok: true }>(`/api/tasks/${taskId}/photos/${photoId}`, { method: "DELETE" });
}
