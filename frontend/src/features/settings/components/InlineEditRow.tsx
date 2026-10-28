import { Pencil } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../../api/client";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/ToastContext";
import { OutlinePillButton } from "./OutlinePillButton";

export interface InlineEditRowProps {
  id?: string;
  title: string;
  description: string;
}

export function InlineEditRow({
  id = "settings-display-name",
  title,
  description,
}: InlineEditRowProps) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(user?.display_name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  // Sync state if external user updates
  useEffect(() => {
    if (!isEditing) {
      setValue(user?.display_name || "");
    }
  }, [user?.display_name, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setError(null);
    setValue(user?.display_name || "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setError(null);
    setValue(user?.display_name || "");
    setIsEditing(false);
    setTimeout(() => editButtonRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    setError(null);
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Display name cannot be empty.");
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length > 100) {
      setError("Display name must be 100 characters or fewer.");
      inputRef.current?.focus();
      return;
    }

    if (trimmed === user?.display_name) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(trimmed, user?.timezone ?? null);
      setIsEditing(false);
      setShowSaved(true);
      toast.success("Profile updated.");
      setTimeout(() => setShowSaved(false), 3000);
      setTimeout(() => editButtonRef.current?.focus(), 0);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiRequestError
          ? err.detail
          : "Failed to update display name.";
      setError(msg);
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  };

  return (
    <div id={id} className={`as-setting-row as-inline-edit-row ${isEditing ? "is-editing" : ""}`}>
      <div className="as-setting-row-left">
        <div className="as-setting-title-line">
          <label htmlFor="inline-edit-display-name-input" className="as-setting-title">
            {title}
          </label>
          {showSaved && <span className="as-saved-pill" role="status">Saved</span>}
        </div>
        <p className="as-setting-description">{description}</p>
      </div>

      <div className="as-setting-row-right">
        {isEditing ? (
          <div className="as-inline-edit-form">
            <div className="as-inline-input-group">
              <input
                id="inline-edit-display-name-input"
                ref={inputRef}
                type="text"
                className={`as-inline-input ${error ? "has-error" : ""}`}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "inline-edit-error" : undefined}
                maxLength={100}
              />
              <div className="as-inline-edit-actions">
                <button
                  type="button"
                  className="as-button as-button-lime as-inline-save-btn"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="as-button as-button-soft as-inline-cancel-btn"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
            {error && (
              <p id="inline-edit-error" className="as-inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="as-inline-view-mode">
            <span className="as-setting-value as-display-name-value">
              {user?.display_name || "—"}
            </span>
            <OutlinePillButton
              ref={editButtonRef}
              icon={Pencil}
              onClick={handleStartEdit}
              aria-label={`Edit ${title}`}
            >
              Edit
            </OutlinePillButton>
          </div>
        )}
      </div>
    </div>
  );
}
