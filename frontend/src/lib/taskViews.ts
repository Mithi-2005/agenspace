import { endOfDay, startOfDay } from "./format";
import type { Task, TaskView } from "../types/tasks";

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  if (task.status === "completed" || !task.due_at) return false;
  return Date.parse(task.due_at) < now.getTime();
}

export function filterTasks(tasks: Task[], view: TaskView, now = new Date()): Task[] {
  const end = endOfDay(now).getTime();

  if (view === "completed") {
    return tasks.filter((task) => task.status === "completed");
  }

  if (view === "all") {
    return tasks;
  }

  const open = tasks.filter((task) => task.status === "open");

  if (view === "today") {
    return open.filter((task) => {
      if (!task.due_at) return true;
      const due = Date.parse(task.due_at);
      return due <= end;
    });
  }

  // upcoming
  return open.filter((task) => {
    if (!task.due_at) return false;
    const due = Date.parse(task.due_at);
    const start = startOfDay(now).getTime();
    return due > end && due >= start;
  });
}

export function openTaskCount(tasks: Task[]): number {
  return tasks.filter((task) => task.status === "open").length;
}
