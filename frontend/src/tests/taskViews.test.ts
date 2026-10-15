import { describe, expect, it } from "vitest";
import { filterTasks, isTaskOverdue } from "../lib/taskViews";
import type { Task } from "../types/tasks";

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? "1",
    title: partial.title ?? "Task",
    description: partial.description ?? null,
    status: partial.status ?? "open",
    priority: partial.priority ?? "none",
    due_at: partial.due_at ?? null,
    completed_at: partial.completed_at ?? null,
    created_at: partial.created_at ?? "2026-10-10T08:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-10-10T08:00:00.000Z",
  };
}

describe("task views", () => {
  const now = new Date("2026-10-10T12:00:00");

  it("places undated and due-today open tasks in Today", () => {
    const tasks = [
      task({ id: "a", due_at: null }),
      task({ id: "b", due_at: "2026-10-10T18:00:00" }),
      task({ id: "c", due_at: "2026-10-12T18:00:00" }),
      task({ id: "d", status: "completed", completed_at: "2026-10-10T09:00:00" }),
    ];
    expect(filterTasks(tasks, "today", now).map((item) => item.id)).toEqual(["a", "b"]);
    expect(filterTasks(tasks, "upcoming", now).map((item) => item.id)).toEqual(["c"]);
    expect(filterTasks(tasks, "completed", now).map((item) => item.id)).toEqual(["d"]);
  });

  it("flags overdue open tasks", () => {
    expect(isTaskOverdue(task({ due_at: "2026-10-09T12:00:00" }), now)).toBe(true);
    expect(isTaskOverdue(task({ due_at: "2026-10-11T12:00:00" }), now)).toBe(false);
  });
});
