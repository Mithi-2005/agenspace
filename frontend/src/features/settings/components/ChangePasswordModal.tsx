import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { ApiRequestError } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { TextField } from "../../../components/ui/TextField";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/ToastContext";

export interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function calculateStrength(pwd: string): {
  score: number;
  label: "Weak" | "Fair" | "Good" | "Strong";
  hint: string;
} {
  if (!pwd) return { score: 0, label: "Weak", hint: "At least 8 characters." };
  if (pwd.length < 8) return { score: 1, label: "Weak", hint: "Must be at least 8 characters." };

  let score = 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

  if (score <= 1) return { score: 1, label: "Weak", hint: "Add numbers or mixed-case letters." };
  if (score === 2) return { score: 2, label: "Fair", hint: "Add symbols or mix uppercase & numbers." };
  if (score === 3) return { score: 3, label: "Good", hint: "Good password strength." };
  return { score: 4, label: "Strong", hint: "Strong and resilient password." };
}

export function ChangePasswordModal({
  open,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const { changePassword } = useAuth();
  const toast = useToast();

  const currentPwId = useId();
  const newPwId = useId();
  const confirmPwId = useId();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});

  const strength = useMemo(() => calculateStrength(newPassword), [newPassword]);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setGeneralError(null);
    setFieldErrors({});
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    const errors: { current?: string; new?: string; confirm?: string } = {};

    if (!currentPassword) {
      errors.current = "Current password is required.";
    }

    if (!newPassword) {
      errors.new = "New password is required.";
    } else if (newPassword.length < 8) {
      errors.new = "New password must be at least 8 characters.";
    } else if (newPassword === currentPassword) {
      errors.new = "New password must be different from your current password.";
    }

    if (!confirmPassword) {
      errors.confirm = "Please confirm your new password.";
    } else if (confirmPassword !== newPassword) {
      errors.confirm = "New passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed. Other active sessions were signed out.");
      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiRequestError
          ? err.detail
          : "Failed to update password. Please check your credentials.";

      const lower = msg.toLowerCase();
      if (lower.includes("current") || lower.includes("incorrect") || lower.includes("invalid password")) {
        setFieldErrors({ current: msg });
      } else if (lower.includes("new password") || lower.includes("match") || lower.includes("character")) {
        setFieldErrors({ new: msg });
      } else {
        setGeneralError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Change password"
      description="Enter your current password and choose a secure new password. Other active sessions will be signed out."
    >
      <form onSubmit={handleSubmit} className="as-change-password-form" noValidate>
        {generalError && (
          <div className="banner banner-error" role="alert">
            <ShieldAlert size={16} />
            <span>{generalError}</span>
          </div>
        )}

        {/* Current Password Field */}
        <TextField
          id={currentPwId}
          label="Current password"
          type={showCurrent ? "text" : "password"}
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            if (fieldErrors.current) {
              setFieldErrors((prev) => ({ ...prev, current: undefined }));
            }
          }}
          error={fieldErrors.current}
          autoComplete="current-password"
          disabled={isSubmitting}
          trailing={
            <button
              type="button"
              className="as-pw-toggle-btn"
              onClick={() => setShowCurrent(!showCurrent)}
              aria-label={showCurrent ? "Hide current password" : "Show current password"}
              tabIndex={0}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        {/* New Password Field */}
        <TextField
          id={newPwId}
          label="New password"
          type={showNew ? "text" : "password"}
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (fieldErrors.new) {
              setFieldErrors((prev) => ({ ...prev, new: undefined }));
            }
          }}
          error={fieldErrors.new}
          autoComplete="new-password"
          disabled={isSubmitting}
          trailing={
            <button
              type="button"
              className="as-pw-toggle-btn"
              onClick={() => setShowNew(!showNew)}
              aria-label={showNew ? "Hide new password" : "Show new password"}
              tabIndex={0}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        {/* Password Strength Indicator */}
        {newPassword && (
          <div className="as-pw-strength-container" aria-live="polite">
            <div className="as-pw-strength-bar-track">
              <div
                className={`as-pw-strength-bar is-level-${strength.score}`}
                style={{ width: `${(strength.score / 4) * 100}%` }}
              />
            </div>
            <div className="as-pw-strength-text">
              <span className={`as-pw-strength-label is-level-${strength.score}`}>
                Strength: {strength.label}
              </span>
              <span className="as-pw-strength-hint">{strength.hint}</span>
            </div>
          </div>
        )}

        {/* Confirm New Password Field */}
        <TextField
          id={confirmPwId}
          label="Confirm new password"
          type={showConfirm ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirm) {
              setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
            }
          }}
          error={fieldErrors.confirm}
          autoComplete="new-password"
          disabled={isSubmitting}
          trailing={
            <button
              type="button"
              className="as-pw-toggle-btn"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              tabIndex={0}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <div className="dialog-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="lime"
            loading={isSubmitting}
          >
            {isSubmitting ? "Changing password…" : "Change password"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
