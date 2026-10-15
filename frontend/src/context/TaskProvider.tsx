import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  completeTaskApi,
  createTaskApi,
  deleteTaskApi,
  listTasksApi,
  reopenTaskApi,
  updateTaskApi,
} from "../api/tasks";
import type { Task, TaskCreate, TaskUpdate, TaskView } from "../types/tasks";
import { TaskContext } from "./taskContextDef";

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<TaskView>("today");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitial, setComposerInitial] = useState<Partial<TaskCreate> | null>(null);

  const refreshTasks = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await listTasksApi({ limit: 200 });
      setTasks(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const createTask = useCallback(
    async (draft: TaskCreate): Promise<Task> => {
      const task = await createTaskApi(draft);
      setTasks((prev) => [task, ...prev]);
      return task;
    },
    [],
  );

  const updateTask = useCallback(async (id: string, patch: TaskUpdate): Promise<Task | null> => {
    const updated = await updateTaskApi(id, patch);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const completeTask = useCallback(async (id: string): Promise<Task | null> => {
    const updated = await completeTaskApi(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const reopenTask = useCallback(async (id: string): Promise<Task | null> => {
    const updated = await reopenTaskApi(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const removeTask = useCallback(async (id: string): Promise<boolean> => {
    await deleteTaskApi(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    return true;
  }, []);

  const openComposer = useCallback((initial?: Partial<TaskCreate>) => {
    setComposerInitial(initial ?? null);
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerInitial(null);
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      isLoading,
      error,
      view,
      setView,
      createTask,
      updateTask,
      completeTask,
      reopenTask,
      removeTask,
      refreshTasks,
      composerOpen,
      openComposer,
      closeComposer,
      composerInitial,
    }),
    [
      tasks,
      isLoading,
      error,
      view,
      createTask,
      updateTask,
      completeTask,
      reopenTask,
      removeTask,
      refreshTasks,
      composerOpen,
      openComposer,
      closeComposer,
      composerInitial,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};
