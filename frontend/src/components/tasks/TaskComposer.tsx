import React, { useEffect, useState } from "react";
import { useTasks } from "../../context/useTasks";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../../lib/format";
import type { TaskPriority } from "../../types/tasks";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";

const PRIORITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

import { useToast } from "../../context/ToastContext";

export const TaskComposer: React.FC = () => {
  const { composerOpen, closeComposer, composerInitial, createTask } = useTasks();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!composerOpen) return;
    setTitle(composerInitial?.title ?? "");
    setDescription((composerInitial as { description?: string })?.description ?? "");
    setDueAt(toDatetimeLocalValue(composerInitial?.due_at ?? null));
    setPriority(composerInitial?.priority ?? "none");
    setTitleError(undefined);
    setSubmitError(null);
  }, [composerOpen, composerInitial]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Add a short title for this task.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTask({
        title: trimmed,
        description: description.trim() || undefined,
        due_at: fromDatetimeLocalValue(dueAt),
        priority,
      });
      toast.success("Task created successfully.");
      closeComposer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create task.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={composerOpen}
      onClose={closeComposer}
      title="Add task"
      description="Tasks are saved to your account and persist across reloads."
    >
      <form className="composer-form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={titleError}
          placeholder="Reply to the venue, prepare the brief…"
          autoComplete="off"
        />
        <div className="field">
          <label htmlFor="task-notes">Notes</label>
          <div className="field-control">
            <textarea
              id="task-notes"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context"
            />
          </div>
        </div>
        <div className="composer-grid">
          <TextField
            label="Due"
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
          <Select
            label="Priority"
            id="task-priority"
            value={priority}
            options={PRIORITY_OPTIONS}
            onChange={(val) => setPriority(val as TaskPriority)}
          />
        </div>
        {submitError && <p className="field-error" role="alert">{submitError}</p>}
        <div className="dialog-actions">
          <Button variant="ghost" onClick={closeComposer} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="lime" loading={submitting}>
            {submitting ? "Saving…" : "Add task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
