import { apiRequest } from "./client";
import type { Task } from "../types/tasks";
import type { KoswayEvent } from "../types/events";

export interface DashboardSummary {
  tasks_open: number;
  tasks_due_today: number;
  tasks_overdue: number;
  tasks_completed: number;
  today_tasks: Task[];
  overdue_tasks: Task[];
  upcoming_events: KoswayEvent[];
}

export async function getDashboardApi(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/api/v1/dashboard");
}
