import type { Task, TaskDraft, TaskUpdate } from "../types/tasks";

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class SessionTaskService {
  private tasks: Task[] = [];
  private snapshot: Task[] = [];
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private sorted(): Task[] {
    return [...this.tasks].sort((a, b) => {
      if (a.completed_at && !b.completed_at) return 1;
      if (!a.completed_at && b.completed_at) return -1;
      const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
      const bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
  }

  private emit(): void {
    this.snapshot = this.sorted();
    this.listeners.forEach((listener) => listener());
  }

  list(): Task[] {
    return this.snapshot;
  }

  create(draft: TaskDraft): Task {
    const timestamp = nowIso();
    const task: Task = {
      id: createId(),
      title: draft.title.trim(),
      description: draft.description ? draft.description.trim() : null,
      due_at: draft.due_at || null,
      priority: draft.priority ?? "none",
      status: "open",
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.tasks = [task, ...this.tasks];
    this.emit();
    return task;
  }

  update(id: string, patch: TaskUpdate): Task | null {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;
    const current = this.tasks[index];
    const isCompleted = patch.status === "completed";
    const next: Task = {
      ...current,
      title: patch.title !== undefined ? patch.title.trim() : current.title,
      description:
        patch.description !== undefined
          ? patch.description
            ? patch.description.trim()
            : null
          : current.description,
      due_at: patch.due_at !== undefined ? patch.due_at : current.due_at,
      priority: patch.priority ?? current.priority,
      status: patch.status ?? current.status,
      completed_at:
        patch.status !== undefined
          ? isCompleted
            ? current.completed_at ?? nowIso()
            : null
          : current.completed_at,
      updated_at: nowIso(),
    };
    this.tasks = [...this.tasks.slice(0, index), next, ...this.tasks.slice(index + 1)];
    this.emit();
    return next;
  }

  remove(id: string): boolean {
    const next = this.tasks.filter((task) => task.id !== id);
    if (next.length === this.tasks.length) return false;
    this.tasks = next;
    this.emit();
    return true;
  }
}

export const taskService = new SessionTaskService();
