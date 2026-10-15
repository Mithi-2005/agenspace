import { createContext } from "react";
import type { Task, TaskCreate, TaskUpdate, TaskView } from "../types/tasks";

export interface TaskContextValue {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  view: TaskView;
  setView: (view: TaskView) => void;
  createTask: (draft: TaskCreate) => Promise<Task>;
  updateTask: (id: string, patch: TaskUpdate) => Promise<Task | null>;
  completeTask: (id: string) => Promise<Task | null>;
  reopenTask: (id: string) => Promise<Task | null>;
  removeTask: (id: string) => Promise<boolean>;
  refreshTasks: () => Promise<void>;
  composerOpen: boolean;
  openComposer: (initial?: Partial<TaskCreate>) => void;
  closeComposer: () => void;
  composerInitial: Partial<TaskCreate> | null;
}

export const TaskContext = createContext<TaskContextValue | undefined>(undefined);
