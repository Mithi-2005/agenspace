import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface TextActionProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  danger?: boolean;
  muted?: boolean;
}

export function TextAction({
  children,
  danger = false,
  muted = true,
  className = "",
  disabled = false,
  type = "button",
  ...props
}: TextActionProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`as-text-action ${danger ? "is-danger" : ""} ${muted ? "is-muted" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
