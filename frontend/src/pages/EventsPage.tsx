import { Calendar, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { createEventApi, deleteEventApi, listEventsApi, updateEventApi } from "../api/events";
import { fromDatetimeLocalValue, formatDateTime, toDatetimeLocalValue } from "../lib/format";
import type { KoswayEvent, EventCreate, EventUpdate } from "../types/events";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Dialog } from "../components/ui/Dialog";
import { TextField } from "../components/ui/TextField";
import { useToast } from "../context/ToastContext";

export const EventsPage: React.FC = () => {
  const toast = useToast();
  const [events, setEvents] = useState<KoswayEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<KoswayEvent | null>(null);

  // Delete confirmation state
  const [eventToDelete, setEventToDelete] = useState<KoswayEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await listEventsApi({ limit: 200 });
      setEvents(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (event: KoswayEvent) => {
    setEditingEvent(event);
    setModalOpen(true);
  };

  const handleSaved = (saved: KoswayEvent) => {
    if (editingEvent) {
      setEvents((prev) =>
        prev
          .map((e) => (e.id === saved.id ? saved : e))
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      );
      toast.success("Event updated successfully.");
    } else {
      setEvents((prev) =>
        [...prev, saved].sort(
          (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
        )
      );
      setTotal((prev) => prev + 1);
      toast.success("Event scheduled successfully.");
    }
    setModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      await deleteEventApi(eventToDelete.id);
      setEvents((prev) => prev.filter((e) => e.id !== eventToDelete.id));
      setTotal((prev) => prev - 1);
      toast.success("Event deleted.");
      setEventToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event.");
    } finally {
      setIsDeleting(false);
    }
  };

  const upcoming = events.filter((e) => new Date(e.starts_at) >= new Date());
  const past = events.filter((e) => new Date(e.starts_at) < new Date());

  return (
    <div className="page-tasks">
      <header className="page-kicker">
        <div>
          <p className="date-line">{total} events</p>
          <h1>Events</h1>
        </div>
        <button type="button" className="btn btn-lime btn-sm" onClick={handleOpenCreate}>
          <Plus size={14} />
          Add event
        </button>
      </header>

      {isLoading ? (
        <div className="empty-state">
          <p>Loading events…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <p className="meta-overdue">{error}</p>
          <button type="button" className="text-link" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <section className="panel panel-primary">
            <h2 className="panel-title">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="empty-state">
                <p>No upcoming events. Add one to get started.</p>
                <button type="button" className="text-link" onClick={handleOpenCreate}>
                  Add event
                </button>
              </div>
            ) : (
              <ul className="task-list">
                {upcoming.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onEdit={() => handleOpenEdit(event)}
                    onDelete={() => setEventToDelete(event)}
                  />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section className="panel" style={{ marginTop: "16px" }}>
              <h2 className="panel-title">Past</h2>
              <ul className="task-list">
                {[...past].reverse().map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    past
                    onEdit={() => handleOpenEdit(event)}
                    onDelete={() => setEventToDelete(event)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      <EventModal
        open={modalOpen}
        initialEvent={editingEvent}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={eventToDelete !== null}
        title="Delete event?"
        description={
          eventToDelete
            ? `Are you sure you want to delete "${eventToDelete.title}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete event"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setEventToDelete(null)}
      />
    </div>
  );
};

interface EventRowProps {
  event: KoswayEvent;
  past?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const EventRow: React.FC<EventRowProps> = ({ event, past, onEdit, onDelete }) => {
  const duration = (() => {
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  })();

  return (
    <li className={`task-row ${past ? "is-complete" : ""}`}>
      <span className="task-check" aria-hidden="true">
        <Calendar size={13} strokeWidth={1.75} />
      </span>
      <div className="task-body">
        <div className="task-main">
          <p className="task-title">{event.title}</p>
          {event.description && <p className="task-note">{event.description}</p>}
          <div className="task-meta">
            <span>
              {formatDateTime(event.starts_at)}
              <span style={{ opacity: 0.55 }}> · {duration}</span>
            </span>
            {event.location && (
              <span>
                <MapPin
                  size={11}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  style={{ display: "inline", marginRight: 2 }}
                />
                {event.location}
              </span>
            )}
          </div>
        </div>
        <div className="task-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit ${event.title}`}
            onClick={onEdit}
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Delete ${event.title}`}
            onClick={onDelete}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </li>
  );
};

interface EventModalProps {
  open: boolean;
  initialEvent: KoswayEvent | null;
  onClose: () => void;
  onSaved: (event: KoswayEvent) => void;
}

const EventModal: React.FC<EventModalProps> = ({ open, initialEvent, onClose, onSaved }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialEvent) {
      setTitle(initialEvent.title);
      setDescription(initialEvent.description ?? "");
      setStartsAt(toDatetimeLocalValue(initialEvent.starts_at));
      setEndsAt(toDatetimeLocalValue(initialEvent.ends_at));
      setLocation(initialEvent.location ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setLocation("");
    }
    setTitleError(undefined);
    setDateError(undefined);
    setSubmitError(null);
  }, [open, initialEvent]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Add a title for this event.");
      return;
    }
    const start = fromDatetimeLocalValue(startsAt);
    const end = fromDatetimeLocalValue(endsAt);
    if (!start) {
      setDateError("Start time is required.");
      return;
    }
    if (!end) {
      setDateError("End time is required.");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      setDateError("End time must be strictly after start time.");
      return;
    }
    setDateError(undefined);
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (initialEvent) {
        const payload: EventUpdate = {
          title: trimmed,
          description: description.trim() || null,
          starts_at: start,
          ends_at: end,
          location: location.trim() || null,
        };
        const updated = await updateEventApi(initialEvent.id, payload);
        onSaved(updated);
      } else {
        const payload: EventCreate = {
          title: trimmed,
          description: description.trim() || undefined,
          starts_at: start,
          ends_at: end,
          location: location.trim() || undefined,
        };
        const created = await createEventApi(payload);
        onSaved(created);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save event.");
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = initialEvent !== null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit event" : "Add event"}
      description="Events are saved to your account and persist across devices."
    >
      <form className="composer-form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={titleError}
          placeholder="Team standup, dentist…"
          autoComplete="off"
        />
        <div className="composer-grid">
          <TextField
            label="Start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <TextField
            label="End"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        {dateError && (
          <p className="field-error" role="alert">
            {dateError}
          </p>
        )}
        <TextField
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Conference room, URL…"
        />
        <div className="field">
          <label htmlFor="event-notes">Notes</label>
          <div className="field-control">
            <textarea
              id="event-notes"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>
        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="lime" loading={submitting}>
            {submitting ? "Saving…" : isEditing ? "Save changes" : "Add event"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
