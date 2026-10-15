import { Loader2 } from "lucide-react";
import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "lime";
type ButtonSize = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}) => {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${loading ? "is-loading" : ""} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2
          size={size === "sm" ? 14 : 16}
          className="btn-spinner"
          aria-hidden="true"
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
};
