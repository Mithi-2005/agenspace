import type { ReactNode } from "react";

export interface StatusTextProps {
  children: ReactNode;
  tone?: "success" | "danger" | "muted";
  className?: string;
}

export function StatusText({
  children,
  tone = "success",
  className = "",
}: StatusTextProps) {
  return (
    <span
      className={`as-status-text as-status-${tone} ${className}`}
      role="status"
    >
      {children}
    </span>
  );
}
