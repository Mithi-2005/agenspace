import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Link2,
  ListTodo,
  Moon,
  Plus,
  UserRound,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { getDashboardApi, type DashboardSummary } from "../api/dashboard";
import { TaskRow } from "../components/tasks/TaskRow";
import { brandConfig } from "../config/brand";
import { useAuth } from "../context/useAuth";
import { useTasks } from "../context/useTasks";
import { formatDateTime, formatLongDate, greetingForHour } from "../lib/format";
import { navigateTo } from "../routing/hashRoute";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { tasks, completeTask, reopenTask, updateTask, removeTask, openComposer } = useTasks();
  const greeting = greetingForHour(new Date().getHours());

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = React.useCallback(async () => {
    try {
      const data = await getDashboardApi();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard, tasks]);

  const handleToggleComplete = async (id: string) => {
    const task = summary?.today_tasks.find((t) => t.id === id) ?? summary?.overdue_tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.status === "completed") await reopenTask(id);
    else await completeTask(id);
    await refreshDashboard();
  };

  const handleUpdate = async (id: string, patch: Parameters<typeof updateTask>[1]) => {
    await updateTask(id, patch);
    await refreshDashboard();
  };

  const handleRemove = async (id: string) => {
    await removeTask(id);
    await refreshDashboard();
  };

  return (
    <div className="page-dashboard">
      <header className="page-kicker">
        <div>
          <p className="date-line">{formatLongDate()}</p>
          <h1>
            {greeting}
            {user?.display_name ? `, ${user.display_name.split(" ")[0]}` : ""}
          </h1>
        </div>
        <p className="session-chip">Signed in</p>
      </header>

      {/* Stats row */}
      {summary && (
        <div className="dash-stats-row" role="region" aria-label="Productivity metrics">
          <div className="dash-stat stat-open">
            <div className="dash-stat-header">
              <span className="dash-stat-label">Open</span>
              <span className="dash-stat-icon" aria-hidden="true">
                <ListTodo size={14} strokeWidth={2} />
              </span>
            </div>
            <p className="dash-stat-value">{summary.tasks_open}</p>
          </div>

          <div className="dash-stat stat-due-today">
            <div className="dash-stat-header">
              <span className="dash-stat-label">Due today</span>
              <span className="dash-stat-icon" aria-hidden="true">
                <CalendarClock size={14} strokeWidth={2} />
              </span>
            </div>
            <p className="dash-stat-value">{summary.tasks_due_today}</p>
          </div>

          <div className={`dash-stat stat-overdue ${summary.tasks_overdue > 0 ? "dash-stat-warn" : ""}`}>
            <div className="dash-stat-header">
              <span className="dash-stat-label">Overdue</span>
              <span className="dash-stat-icon" aria-hidden="true">
                <AlertCircle size={14} strokeWidth={2} />
              </span>
            </div>
            <p className="dash-stat-value">{summary.tasks_overdue}</p>
          </div>

          <div className="dash-stat stat-completed">
            <div className="dash-stat-header">
              <span className="dash-stat-label">Completed</span>
              <span className="dash-stat-icon" aria-hidden="true">
                <CheckCircle2 size={14} strokeWidth={2} />
              </span>
            </div>
            <p className="dash-stat-value">{summary.tasks_completed}</p>
          </div>
        </div>
      )}

      <div className="dash-layout">
        <section className="panel panel-primary" aria-labelledby="today-heading">
          <header className="panel-head">
            <div>
              <h2 id="today-heading">Today</h2>
              <p>Tasks due today and overdue items.</p>
            </div>
            <button type="button" className="btn btn-lime btn-sm" onClick={() => openComposer()}>
              <Plus size={14} />
              Add task
            </button>
          </header>

          {isLoading ? (
            <div className="empty-state"><p>Loading…</p></div>
          ) : error ? (
            <div className="empty-state"><p className="meta-overdue">{error}</p></div>
          ) : (
            <>
              {(summary?.overdue_tasks ?? []).length > 0 && (
                <div style={{ marginBottom: "8px" }}>
                  <p className="panel-title meta-overdue" style={{ paddingBottom: "4px" }}>
                    <AlertCircle size={13} strokeWidth={1.75} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
                    Overdue
                  </p>
                  <ul className="task-list">
                    {summary!.overdue_tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggleComplete={(id) => void handleToggleComplete(id)}
                        onUpdate={(id, patch) => void handleUpdate(id, patch)}
                        onRemove={(id) => void handleRemove(id)}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {(summary?.today_tasks ?? []).length === 0 && (summary?.overdue_tasks ?? []).length === 0 ? (
                <div className="empty-state">
                  <p>No open tasks for today.</p>
                  <button type="button" className="text-link" onClick={() => openComposer()}>Create one</button>
                </div>
              ) : (
                <ul className="task-list">
                  {(summary?.today_tasks ?? []).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggleComplete={(id) => void handleToggleComplete(id)}
                      onUpdate={(id, patch) => void handleUpdate(id, patch)}
                      onRemove={(id) => void handleRemove(id)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <aside className="dash-side">
          <section className="panel" aria-labelledby="events-heading">
            <header className="panel-head">
              <div>
                <h2 id="events-heading">Upcoming events</h2>
                <p>Next 7 days</p>
              </div>
              <button type="button" className="icon-btn" aria-label="View all events" onClick={() => navigateTo("events")}>
                <CalendarClock size={16} strokeWidth={1.75} />
              </button>
            </header>
            {isLoading ? (
              <div className="empty-state compact"><p>Loading…</p></div>
            ) : (summary?.upcoming_events ?? []).length === 0 ? (
              <div className="empty-state compact">
                <p>No events in the next 7 days.</p>
                <button type="button" className="text-link" onClick={() => navigateTo("events")}>
                  Add event <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <ul className="task-list">
                {summary!.upcoming_events.map((event) => (
                  <li key={event.id} className="task-row">
                    <span className="task-check" aria-hidden="true">
                      <Calendar size={13} strokeWidth={1.75} />
                    </span>
                    <div className="task-body">
                      <div className="task-main">
                        <p className="task-title">{event.title}</p>
                        <div className="task-meta">
                          <span>{formatDateTime(event.starts_at)}</span>
                          {event.location && <span>{event.location}</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <nav className="quick-row" aria-label="Quick actions">
        <button type="button" className="quick-action" onClick={() => openComposer()}>
          <Plus size={16} />
          Add task
        </button>
        <button type="button" className="quick-action" onClick={() => navigateTo("tasks")}>
          <CalendarClock size={16} />
          Open tasks
        </button>
        <button type="button" className="quick-action" onClick={() => navigateTo("events")}>
          <Calendar size={16} />
          Events
        </button>
        <button type="button" className="quick-action" onClick={() => navigateTo("connections")}>
          <Link2 size={16} />
          Connections
        </button>
        <button type="button" className="quick-action" onClick={() => navigateTo("account")}>
          <UserRound size={16} />
          Account
        </button>
      </nav>

      <p className="moon-aside">
        <Moon size={14} strokeWidth={1.75} aria-hidden="true" />
        {brandConfig.assistantName} will join this workspace later. There is no assistant chat in this release.
      </p>
    </div>
  );
};
