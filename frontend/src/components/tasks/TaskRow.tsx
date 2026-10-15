import { Check, Clock3, Pencil, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { formatDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from "../../lib/format";
import type { Task, TaskPriority, TaskUpdate } from "../../types/tasks";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { useToast } from "../../context/ToastContext";

const PRIORITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface TaskRowProps {
  task: Task;
  onToggleComplete: (id: string) => void | Promise<void>;
  onUpdate: (id: string, patch: TaskUpdate) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  none: "",
  low: "Low",
  medium: "Med",
  high: "High",
};

function isTaskOverdue(task: Task): boolean {
  if (!task.due_at || task.status === "completed") return false;
  return new Date(task.due_at) < new Date();
}

export const TaskRow: React.FC<TaskRowProps> = ({ task, onToggleComplete, onUpdate, onRemove }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueAt, setDueAt] = useState(toDatetimeLocalValue(task.due_at));
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const overdue = isTaskOverdue(task);
  const isComplete = task.status === "completed";

  const handleToggle = async () => {
    try {
      await onToggleComplete(task.id);
      if (!isComplete) {
        toast.success("Task marked complete.", {
          actionLabel: "Undo",
          onAction: () => void onToggleComplete(task.id),
        });
      } else {
        toast.info("Task reopened.");
      }
    } catch {
      toast.error("Failed to update task status.");
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Task title cannot be empty.");
      return;
    }
    setTitleError(undefined);
    setIsSaving(true);
    try {
      await onUpdate(task.id, {
        title: trimmed,
        due_at: fromDatetimeLocalValue(dueAt),
        priority,
      });
      toast.success("Task updated.");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onRemove(task.id);
      toast.success("Task deleted.");
      setConfirmDeleteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <li className={`task-row ${isComplete ? "is-complete" : ""} ${overdue ? "is-overdue" : ""}`}>
        <button
          type="button"
          className="task-check"
          aria-label={isComplete ? "Reopen task" : "Mark task complete"}
          aria-pressed={isComplete}
          onClick={() => void handleToggle()}
        >
          {isComplete ? <Check size={13} strokeWidth={2.4} /> : null}
        </button>

        {editing ? (
          <form className="task-edit" onSubmit={save} noValidate>
            <TextField
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={titleError}
            />
            <div className="composer-grid">
              <TextField
                label="Due"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
              <Select
                label="Priority"
                id={`priority-${task.id}`}
                value={priority}
                options={PRIORITY_OPTIONS}
                onChange={(val) => setPriority(val as TaskPriority)}
              />
            </div>
            <div className="dialog-actions">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm" loading={isSaving}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="task-body">
            <div className="task-main">
              <p className="task-title">{task.title}</p>
              {task.description ? <p className="task-note">{task.description}</p> : null}
              <div className="task-meta">
                {task.due_at ? (
                  <span className={overdue ? "meta-overdue" : undefined}>
                    <Clock3 size={12} strokeWidth={1.75} aria-hidden="true" />
                    {overdue ? "Overdue · " : ""}
                    {formatDateTime(task.due_at)}
                  </span>
                ) : (
                  <span>No due date</span>
                )}
                {PRIORITY_LABEL[task.priority] ? <span>{PRIORITY_LABEL[task.priority]}</span> : null}
              </div>
            </div>
            <div className="task-actions">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Edit ${task.title}`}
                onClick={() => setEditing(true)}
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete ${task.title}`}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </li>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete task?"
        description={`Are you sure you want to delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete task"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
};
