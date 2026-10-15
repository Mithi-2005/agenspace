import { Plus, RefreshCw } from "lucide-react";
import React, { useMemo } from "react";
import { TaskRow } from "../components/tasks/TaskRow";
import { useTasks } from "../context/useTasks";
import { filterTasks, openTaskCount } from "../lib/taskViews";
import type { TaskView } from "../types/tasks";

const VIEWS: { id: TaskView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

export const TasksPage: React.FC = () => {
  const { tasks, isLoading, error, view, setView, openComposer, updateTask, completeTask, reopenTask, removeTask, refreshTasks } = useTasks();
  const visible = useMemo(() => filterTasks(tasks, view), [tasks, view]);
  const openCount = openTaskCount(tasks);

  const handleToggleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.status === "completed") {
      await reopenTask(id);
    } else {
      await completeTask(id);
    }
  };

  return (
    <div className="page-tasks">
      <header className="page-kicker">
        <div>
          <p className="date-line">{openCount} open</p>
          <h1>Tasks</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh tasks"
            onClick={() => void refreshTasks()}
          >
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
          <button type="button" className="btn btn-lime btn-sm" onClick={() => openComposer()}>
            <Plus size={14} />
            Add task
          </button>
        </div>
      </header>

      <div className="view-tabs" role="tablist" aria-label="Task views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            className={view === item.id ? "is-active" : undefined}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="panel panel-primary">
        {isLoading ? (
          <div className="empty-state">
            <p>Loading tasks…</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <p className="meta-overdue">{error}</p>
            <button type="button" className="text-link" onClick={() => void refreshTasks()}>
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p>
              {view === "completed"
                ? "No completed tasks yet."
                : view === "upcoming"
                  ? "Tasks due after today appear in Upcoming."
                  : "Nothing on today's list. Add a task to start."}
            </p>
            {view !== "completed" ? (
              <button type="button" className="text-link" onClick={() => openComposer()}>
                Add task
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="task-list">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggleComplete={(id) => void handleToggleComplete(id)}
                onUpdate={(id, patch) => void updateTask(id, patch)}
                onRemove={(id) => void removeTask(id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
