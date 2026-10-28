import { brandConfig } from "../../config/brand";
import { workspaceData } from "../../data/workspace";
import type { Task } from "../../types/tasks";

export const moon = brandConfig.assistantName;
export const activityRows = workspaceData.activity;
export const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
};
export const taskDue = (task: Task) =>
  task.due_at
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(task.due_at))
    : "No due date";
