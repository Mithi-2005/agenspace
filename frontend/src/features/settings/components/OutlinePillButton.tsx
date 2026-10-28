import { forwardRef } from "react";

export interface OutlinePillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ElementType;
  trailingIcon?: React.ElementType;
  danger?: boolean;
}

export const OutlinePillButton = forwardRef<
  HTMLButtonElement,
  OutlinePillButtonProps
>(function OutlinePillButton(
  {
    children,
    icon: Icon,
    trailingIcon: TrailingIcon,
    danger = false,
    className = "",
    disabled = false,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={`as-outline-pill-button ${danger ? "is-danger" : ""} ${className}`}
      {...props}
    >
      {Icon && <Icon size={14} className="as-pill-icon-lead" aria-hidden="true" />}
      <span>{children}</span>
      {TrailingIcon && (
        <TrailingIcon size={14} className="as-pill-icon-trail" aria-hidden="true" />
      )}
    </button>
  );
});
