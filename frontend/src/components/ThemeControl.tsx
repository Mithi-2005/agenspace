import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/useTheme";
import type { ThemePreference } from "../theme/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

interface ThemeControlProps {
  compact?: boolean;
}

export const ThemeControl: React.FC<ThemeControlProps> = ({ compact = false }) => {
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={`theme-control ${compact ? "theme-control-compact" : ""}`}
      role="radiogroup"
      aria-label="Appearance"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? "is-selected" : undefined}
            onClick={() => setPreference(option.value)}
            title={option.label}
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
            {compact ? <span className="sr-only">{option.label}</span> : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
};
