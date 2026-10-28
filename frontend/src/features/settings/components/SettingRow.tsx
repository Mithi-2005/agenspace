import type { ReactNode } from "react";
import { ComingSoonTag } from "./ComingSoonTag";
import { StatusText } from "./StatusText";

export interface SettingRowProps {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  status?: ReactNode;
  statusTone?: "success" | "danger" | "muted";
  control?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
  children?: ReactNode;
  className?: string;
}

export function SettingRow({
  id,
  title,
  description,
  value,
  status,
  statusTone = "success",
  control,
  danger = false,
  disabled = false,
  comingSoon = false,
  children,
  className = "",
}: SettingRowProps) {
  const isAriaDisabled = disabled || comingSoon;

  return (
    <div
      id={id}
      className={`as-setting-row ${danger ? "is-danger" : ""} ${isAriaDisabled ? "is-disabled" : ""} ${className}`}
      aria-disabled={isAriaDisabled ? true : undefined}
    >
      <div className="as-setting-row-left">
        <div className="as-setting-title-line">
          <span className="as-setting-title">{title}</span>
          {comingSoon && <ComingSoonTag />}
        </div>
        {description && (
          <p className="as-setting-description">{description}</p>
        )}
      </div>

      <div className="as-setting-row-right">
        {value !== undefined && (
          <div className="as-setting-value-block">
            <span className="as-setting-value">{value}</span>
            {status && <StatusText tone={statusTone}>{status}</StatusText>}
          </div>
        )}
        {control && (
          <div
            className={`as-setting-control ${comingSoon ? "is-coming-soon" : ""}`}
            aria-disabled={comingSoon ? true : undefined}
          >
            {control}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
