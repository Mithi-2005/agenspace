export type TaskStatus = "open" | "completed";
export type TaskPriority = "none" | "low" | "medium" | "high";
export type TaskSource = "user" | "imported" | "suggested" | "confirmed";
export type TaskView = "today" | "upcoming" | "completed" | "all";

/** Task as returned by the server API */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload for creating a task */
export interface TaskCreate {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
}

/** Payload for updating a task */
export interface TaskUpdate {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  status?: TaskStatus;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
}

/** Legacy types for in-session composer draft (kept for composer compat) */
export interface TaskDraft {
  title: string;
  description?: string;
  due_at?: string | null;
  priority?: TaskPriority;
}
