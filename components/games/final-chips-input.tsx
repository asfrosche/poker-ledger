"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { parseFinalChips } from "@/lib/validation/schemas";

interface Props {
  label: string;
  value: number | null;
  disabled?: boolean;
  onCommit: (chips: number | null) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Numeric final-chip input. Commits valid values immediately so totals recalculate
 * as the host types. Keeps the typed text while the value stays the same, and
 * re-syncs when the saved value changes elsewhere.
 */
export function FinalChipsInput({ label, value, disabled, onCommit, className, size = "md" }: Props) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [lastValue, setLastValue] = useState(value);
  const [error, setError] = useState<string | undefined>();

  if (value !== lastValue) {
    setLastValue(value);
    setText(value === null ? "" : String(value));
    setError(undefined);
  }

  return (
    <div className={clsx("flex flex-col", className)}>
      <input
        aria-label={label}
        inputMode="numeric"
        autoComplete="off"
        className={clsx(
          "field num text-right",
          size === "sm" && "field-compact text-base",
          size === "lg" && "h-12 text-lg",
          error && "border-loss",
        )}
        placeholder="Count"
        value={text}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = parseFinalChips(next);
          if (parsed.error) {
            setError(parsed.error);
            return;
          }
          setError(undefined);
          onCommit(parsed.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      {error ? <span role="alert" className="mt-1 text-[11px] text-loss">{error}</span> : null}
    </div>
  );
}
