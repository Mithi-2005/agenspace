import { Check, ChevronDown } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  id?: string;
  hint?: string;
  error?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onChange,
  id,
  hint,
  error,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dialogPanel = containerRef.current.closest(".dialog-panel");
      if (dialogPanel) {
        const dialogRect = dialogPanel.getBoundingClientRect();
        const spaceInDialogBelow = dialogRect.bottom - rect.bottom;
        setOpenUpward(spaceInDialogBelow < 170);
      } else {
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUpward(spaceBelow < 180);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`field ${error ? "field-invalid" : ""} ${className}`.trim()} ref={containerRef}>
      <label id={`${fieldId}-label`} htmlFor={fieldId}>
        {label}
      </label>
      <div className="custom-select-wrapper">
        <button
          type="button"
          id={fieldId}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${fieldId}-label ${fieldId}`}
          className={`field-control custom-select-trigger ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="custom-select-value">{selectedOption?.label}</span>
          <ChevronDown
            size={15}
            strokeWidth={2}
            className={`custom-select-chevron ${isOpen ? "is-rotated" : ""}`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <ul
            role="listbox"
            aria-labelledby={`${fieldId}-label`}
            className={`custom-select-menu ${openUpward ? "is-upward" : ""}`}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <Check size={14} strokeWidth={2.5} className="custom-select-check" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
};
