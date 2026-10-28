import type { ElementType, KeyboardEvent } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ElementType;
}

export interface SegmentedControlProps<T extends string> {
  id?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  id,
  options,
  value,
  onChange,
  ariaLabel = "Select option",
  disabled = false,
  className = "",
}: SegmentedControlProps<T>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const currentIndex = options.findIndex((opt) => opt.value === value);
    if (currentIndex === -1) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % options.length;
      onChange(options[nextIndex].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + options.length) % options.length;
      onChange(options[prevIndex].value);
    }
  };

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`as-segmented-control ${disabled ? "is-disabled" : ""} ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            className={`as-segmented-btn ${isSelected ? "is-selected" : ""}`}
            onClick={() => onChange(option.value)}
            tabIndex={-1}
          >
            {Icon && <Icon size={14} className="as-segmented-icon" aria-hidden="true" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
