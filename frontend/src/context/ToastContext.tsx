import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, options?: { actionLabel?: string; onAction?: () => void }) => void;
  success: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", options?: { actionLabel?: string; onAction?: () => void }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = {
        id,
        type,
        message,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
      };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep up to 4 toasts max

      setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, options?: { actionLabel?: string; onAction?: () => void }) => {
      showToast(message, "success", options);
    },
    [showToast]
  );

  const error = useCallback(
    (message: string) => {
      showToast(message, "error");
    },
    [showToast]
  );

  const info = useCallback(
    (message: string) => {
      showToast(message, "info");
    },
    [showToast]
  );

  const value = useMemo(
    () => ({ showToast, success, error, info }),
    [showToast, success, error, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item is-${toast.type}`} role="status">
            <span className="toast-icon" aria-hidden="true">
              {toast.type === "success" && <CheckCircle2 size={16} strokeWidth={2.2} />}
              {toast.type === "error" && <AlertCircle size={16} strokeWidth={2.2} />}
              {toast.type === "info" && <Info size={16} strokeWidth={2.2} />}
            </span>
            <p className="toast-message">{toast.message}</p>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="toast-action-btn"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              className="toast-close-btn"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
