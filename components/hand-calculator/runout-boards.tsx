"use client";

import { clsx } from "clsx";
import { CardFace } from "./card-face";
import { isSelectable, runBoard, sameTarget, sharedPrefix, type TableState, type Target } from "@/lib/hand-table/table-state";
import { streetLabel } from "@/lib/hand-table/labels";

// Each runout gets its own colour so the boards are easy to tell apart.
const RUN_STYLES = [
  { badge: "bg-accent text-white", bar: "border-l-accent" },
  { badge: "bg-[#2f6fb3] text-white", bar: "border-l-[#2f6fb3]" },
  { badge: "bg-[#7a4fb5] text-white", bar: "border-l-[#7a4fb5]" },
] as const;

/** One row per runout. Shared cards are shown in every row; each row's own cards are editable. */
export function RunoutBoards({
  state,
  onSelect,
  onClear,
}: {
  state: TableState;
  onSelect: (target: Target) => void;
  onClear: (target: Target) => void;
}) {
  if (state.runCount === 1) return null;
  const prefix = sharedPrefix(state);

  return (
    <section aria-labelledby="runs-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="runs-heading" className="label">
          Runouts
        </h2>
        <p className="text-xs text-muted">
          {prefix === 0 ? "Each run is a full board" : `Shared: ${streetLabel(0)}–${streetLabel(prefix - 1)}`}
        </p>
      </div>

      {Array.from({ length: state.runCount }, (_, run) => {
        const board = runBoard(state, run);
        const filled = board.filter((c) => c !== null).length;
        const style = RUN_STYLES[run];
        return (
          <article
            key={run}
            aria-label={`Run ${run + 1}`}
            className={clsx("panel flex flex-col gap-3 border-l-4 p-3 sm:p-4", style.bar)}
          >
            <header className="flex items-center justify-between gap-2">
              <span className={clsx("rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em]", style.badge)}>
                Run {run + 1}
              </span>
              <span className="font-mono text-[11px] text-muted">{filled} of 5 cards</span>
            </header>
            <div className="flex items-end gap-1.5 sm:gap-2">
              {board.map((card, index) => {
                const shared = index < prefix;
                const target: Target = { kind: "run", run, index };
                const editable = !shared && isSelectable(state, target);
                const hasCard = card !== null;
                return (
                  <div key={index} className="flex flex-col items-center gap-1">
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                      {streetLabel(index)}
                    </span>
                    <CardFace
                      size="md"
                      card={card}
                      shared={shared}
                      label={`Run ${run + 1}, ${streetLabel(index)}${shared ? ", shared" : ""}${card === null ? ", empty" : ""}`}
                      selected={sameTarget(state.active, target)}
                      onSelect={!shared && (editable || hasCard) ? () => onSelect(target) : undefined}
                      onClear={!shared ? () => onClear(target) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}
