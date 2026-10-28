import React, { useEffect, useRef, useState } from "react";

export function SampleDataBadge() {
  return <span className="sample-badge">Sample data</span>;
}
export function Card({
  children,
  className = "",
  reveal = 0,
}: {
  children: React.ReactNode;
  className?: string;
  reveal?: number;
}) {
  return (
    <section
      className={`as-card as-reveal ${className}`}
      style={{ "--reveal-index": reveal } as React.CSSProperties}
    >
      {children}
    </section>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "danger";
}) {
  return (
    <button
      className={`as-button as-button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "hot" | "success" | "danger";
}) {
  return <span className={`as-tag as-tag-${tone}`}>{children}</span>;
}
export function PageHeader({
  title,
  description,
  actions,
  sample = false,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  sample?: boolean;
}) {
  return (
    <header className="as-page-header">
      <div>
        <div className="as-heading-line">
          <h1>{title}</h1>
          {sample && <SampleDataBadge />}
        </div>
        <p>{description}</p>
      </div>
      {actions && <div className="as-page-actions">{actions}</div>}
    </header>
  );
}
export function StatCard({
  label,
  value,
  detail,
  hot = false,
  reveal = 0,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  hot?: boolean;
  reveal?: number;
}) {
  return (
    <Card reveal={reveal} className={`as-stat ${hot ? "is-hot" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  );
}
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="as-tabs" role="tablist" aria-label="View filters">
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          className={active === tab ? "is-active" : ""}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
export function DataTable({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="as-table-wrap">
      <table aria-label={label} className="as-table">
        {children}
      </table>
    </div>
  );
}
export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  return (
    <div className="as-progress" aria-label={label}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export function ProgressRing({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const length = 2 * Math.PI * 22;
  return (
    <div className="as-ring" role="img" aria-label={`${label}: ${value}%`}>
      <svg viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" />
        <circle
          className="as-ring-value"
          cx="26"
          cy="26"
          r="22"
          style={{
            strokeDasharray: length,
            strokeDashoffset: length * (1 - value / 100),
          }}
        />
      </svg>
      <span>{value}%</span>
    </div>
  );
}
export function BarChart({ values }: { values: number[] }) {
  return (
    <div
      className="as-bars"
      role="img"
      aria-label="Weekly completion: 18, 35, 52, 42, 70, 64, 48 percent"
    >
      {values.map((value, index) => (
        <span
          key={index}
          className={index === 3 ? "is-today" : ""}
          style={
            {
              "--bar-height": `${value}%`,
              "--bar-index": index,
            } as React.CSSProperties
          }
        >
          <i />
        </span>
      ))}
    </div>
  );
}
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      className={`as-switch ${checked ? "is-on" : ""} ${disabled ? "is-disabled" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(event) => {
        if (!disabled && event.key === "Enter") {
          event.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <span />
    </button>
  );
}
export function Skeleton() {
  return (
    <div className="as-skeleton" aria-label="Loading content">
      <span />
      <span />
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="as-empty">
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced.current) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - started) / 1100, 1);
      setDisplay(Math.round(value * (1 - (1 - progress) ** 4)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span aria-label={new Intl.NumberFormat().format(value)}>
      {new Intl.NumberFormat().format(display)}
    </span>
  );
}
