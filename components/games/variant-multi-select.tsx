"use client";

import { clsx } from "clsx";
import { GAME_VARIANTS, variantsLabel } from "@/lib/game-variants";
import type { GameVariant } from "@/types";

/**
 * Dropdown with checkboxes for picking one or more game variants. The closed control shows the picks;
 * opening it lists every variant with its description. Native details/summary keeps it keyboard-friendly.
 */
export function VariantMultiSelect({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  value: GameVariant[];
  onChange: (next: GameVariant[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  function toggle(key: GameVariant, checked: boolean) {
    // Picks keep the order they were made in.
    onChange(checked ? [...value, key] : value.filter((v) => v !== key));
  }

  return (
    <details className="group">
      <summary
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={clsx(
          "field flex cursor-pointer list-none items-center justify-between gap-2",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span className="truncate">{value.length > 0 ? variantsLabel(value) : "Pick one or more variants"}</span>
        <span aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div role="group" aria-labelledby={id} className="mt-1 flex flex-col gap-1 rounded-[10px] border border-line bg-panel p-2">
        {GAME_VARIANTS.map((variant) => {
          const checked = value.includes(variant.key);
          return (
            <label
              key={variant.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-[8px] px-2 py-2 hover:bg-surface"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                checked={checked}
                disabled={disabled}
                onChange={(event) => toggle(variant.key, event.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{variant.label}</span>
                <span className="block text-xs text-muted">{variant.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
