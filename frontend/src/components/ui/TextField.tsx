import React from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, trailing, leading, id, className = "", ...props }, ref) => {
    const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const describedBy = [errorId, hintId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

    return (
      <div className={`field ${error ? "field-invalid" : ""} ${className}`.trim()}>
        <label htmlFor={fieldId}>{label}</label>
        <div className={`field-control ${leading ? "has-leading" : ""} ${trailing ? "has-trailing" : ""}`}>
          {leading ? <span className="field-leading">{leading}</span> : null}
          <input
            ref={ref}
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...props}
          />
          {trailing}
        </div>
        {error ? (
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";
