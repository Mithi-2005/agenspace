import { AlertTriangle } from "lucide-react";
import React from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "lime" | "primary";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  return (
    <Dialog open={open} onClose={isLoading ? () => {} : onClose} title={title}>
      <div className="confirm-dialog-body">
        <div className={`confirm-dialog-icon is-${variant}`} aria-hidden="true">
          <AlertTriangle size={24} strokeWidth={2} />
        </div>
        <p className="confirm-dialog-desc">{description}</p>
      </div>
      <div className="dialog-actions confirm-dialog-actions">
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          onClick={() => void onConfirm()}
          loading={isLoading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
};
